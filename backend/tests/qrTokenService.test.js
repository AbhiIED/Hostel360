import { test, describe } from 'node:test';
import assert from 'node:assert';
import { generateQrToken, validateAndConsume } from '../src/services/qrTokenService.js';
import prisma from '../src/prisma.js';

describe('QR Token Service Tests (11.3)', () => {
  async function getGateDevice() {
    const dev = await prisma.device.findFirst({
      where: { purpose: 'GATE', is_active: true },
    });
    assert.ok(dev, 'Active gate device must exist in database');
    return dev;
  }

  test('generateQrToken produces 32-byte opaque token with 20s TTL and SHA-256 hash', async () => {
    const gateDevice = await getGateDevice();
    const issued = await generateQrToken(gateDevice.id);
    assert.ok(issued.token);
    assert.strictEqual(issued.ttl, 20);
    assert.strictEqual(typeof issued.token, 'string');
    assert.ok(issued.token.length >= 32);

    // Verify token record in DB has SHA-256 hash stored, not plain token
    const dbToken = await prisma.qrToken.findUnique({
      where: { token_hash: issued.record.token_hash },
    });
    assert.ok(dbToken);
    assert.strictEqual(dbToken.status, 'UNUSED');
    assert.strictEqual(dbToken.device_id, gateDevice.id);
  });

  test('generating a new token for same device revokes the previous UNUSED token', async () => {
    const gateDevice = await getGateDevice();
    const token1 = await generateQrToken(gateDevice.id);
    const token2 = await generateQrToken(gateDevice.id);

    // Token 1 must now be REVOKED
    const dbToken1 = await prisma.qrToken.findUnique({
      where: { token_hash: token1.record.token_hash },
    });
    assert.strictEqual(dbToken1.status, 'REVOKED');

    // Token 2 must be UNUSED
    const dbToken2 = await prisma.qrToken.findUnique({
      where: { token_hash: token2.record.token_hash },
    });
    assert.strictEqual(dbToken2.status, 'UNUSED');

    // Attempting to consume revoked token1 must fail
    const consumeRevoked = await validateAndConsume(token1.token);
    assert.strictEqual(consumeRevoked.valid, false);
    assert.strictEqual(consumeRevoked.code, 'TOKEN_REVOKED');
  });

  test('validateAndConsume atomically transitions token status to USED', async () => {
    const gateDevice = await getGateDevice();
    const freshToken = await generateQrToken(gateDevice.id);
    const consumeRes = await validateAndConsume(freshToken.token);

    assert.strictEqual(consumeRes.valid, true);
    assert.ok(consumeRes.token);
    assert.strictEqual(consumeRes.token.status, 'USED');

    // Re-consuming same token must fail with TOKEN_ALREADY_USED
    const reConsume = await validateAndConsume(freshToken.token);
    assert.strictEqual(reConsume.valid, false);
    assert.strictEqual(reConsume.code, 'TOKEN_ALREADY_USED');
  });
});

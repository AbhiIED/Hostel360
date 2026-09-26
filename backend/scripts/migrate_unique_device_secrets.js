import crypto from 'crypto';
import bcrypt from 'bcrypt';
import prisma from '../src/prisma.js';

async function migrateSecrets() {
  console.log('Migrating all devices to unique 32-byte cryptographically random secrets...');
  const devices = await prisma.device.findMany();

  const generatedSecrets = [];

  for (const device of devices) {
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const salt = await bcrypt.genSalt(10);
    const secretHash = await bcrypt.hash(rawSecret, salt);

    await prisma.device.update({
      where: { id: device.id },
      data: { secret_hash: secretHash },
    });

    generatedSecrets.push({
      id: device.id,
      name: device.device_name,
      code: device.device_code,
      secret: rawSecret,
    });
  }

  console.log('Successfully updated all devices with distinct secrets.');
  console.log('Generated Device Secrets:');
  console.table(generatedSecrets);
  await prisma.$disconnect();
}

migrateSecrets().catch((e) => {
  console.error('Migration failed:', e);
  process.exit(1);
});

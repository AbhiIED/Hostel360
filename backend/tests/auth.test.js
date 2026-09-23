import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { app } from '../src/index.js';
import prisma from '../src/prisma.js';

describe('Auth Endpoint Tests (11.2)', () => {
  let studentAccessToken = '';
  let studentRefreshToken = '';

  test('POST /api/auth/login with valid credentials returns tokens', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'aarav.sharma@student.hostel360.com',
        password: 'password123',
      });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.ok(res.body.refreshToken);
    assert.strictEqual(res.body.user.role, 'STUDENT');

    studentAccessToken = res.body.accessToken;
    studentRefreshToken = res.body.refreshToken;
  });

  test('POST /api/auth/login with invalid password returns 401', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'aarav.sharma@student.hostel360.com',
        password: 'wrongpassword',
      });

    assert.strictEqual(res.status, 401);
    assert.strictEqual(res.body.error, 'Invalid email or password');
  });

  test('POST /api/auth/login with malformed email returns 400', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'not-valid-email',
        password: 'password123',
      });

    assert.strictEqual(res.status, 400);
  });

  test('GET /api/auth/me returns authenticated user profile', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${studentAccessToken}`);

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.user.email, 'aarav.sharma@student.hostel360.com');
  });

  test('POST /api/auth/refresh rotates refresh token atomically', async () => {
    const res = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: studentRefreshToken });

    assert.strictEqual(res.status, 200);
    assert.ok(res.body.accessToken);
    assert.ok(res.body.refreshToken);
    assert.notStrictEqual(res.body.refreshToken, studentRefreshToken);

    // Attempting reuse of original studentRefreshToken must trigger breach alert and 401
    const reuseRes = await request(app)
      .post('/api/auth/refresh')
      .send({ refreshToken: studentRefreshToken });

    assert.strictEqual(reuseRes.status, 401);
    assert.match(reuseRes.body.error, /reuse detected/i);
  });
});

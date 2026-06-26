import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import { cleanDatabase } from '../test/helpers';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── helpers ──────────────────────────────────────────────────────────────────

async function registerAdmin() {
  return request(app)
    .post('/api/auth/register')
    .send({ email: 'admin@test.com', password: 'password123', name: 'Test Admin' });
}

async function loginAdmin() {
  await registerAdmin();
  return request(app)
    .post('/api/auth/login')
    .send({ email: 'admin@test.com', password: 'password123' });
}

// ─── POST /api/auth/register ──────────────────────────────────────────────────

describe('POST /api/auth/register', () => {
  it('creates the first admin and returns id, email, and role', async () => {
    const res = await registerAdmin();

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.email).toBe('admin@test.com');
    expect(res.body.role).toBe('ADMIN');
  });

  it('returns 403 when an admin already exists', async () => {
    await registerAdmin();

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'second@test.com', password: 'password123' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'password123' });

    expect(res.status).toBe(400);
  });

  it('returns 400 when password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'admin@test.com' });

    expect(res.status).toBe(400);
  });
});

// ─── POST /api/auth/login ─────────────────────────────────────────────────────

describe('POST /api/auth/login', () => {
  it('returns user info and sets a cookie for valid credentials', async () => {
    const res = await loginAdmin();

    expect(res.status).toBe(200);
    expect(res.body.email).toBe('admin@test.com');
    expect(res.body.role).toBe('ADMIN');
    expect(res.headers['set-cookie']).toBeDefined();
  });

  it('returns 401 for wrong password', async () => {
    await registerAdmin();

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'admin@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
  });

  it('returns 401 for unknown email', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'password123' });

    expect(res.status).toBe(401);
  });
});

// ─── GET /api/auth/me ─────────────────────────────────────────────────────────

describe('GET /api/auth/me', () => {
  it('returns userId and role when authenticated', async () => {
    const loginRes = await loginAdmin();
    const cookie = loginRes.headers['set-cookie'];

    const res = await request(app)
      .get('/api/auth/me')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('userId');
    expect(res.body.role).toBe('ADMIN');
  });

  it('returns 401 when no cookie is sent', async () => {
    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
  });
});

// ─── POST /api/auth/logout ────────────────────────────────────────────────────

describe('POST /api/auth/logout', () => {
  it('clears the token cookie', async () => {
    const loginRes = await loginAdmin();
    const cookie = loginRes.headers['set-cookie'];

    const res = await request(app)
      .post('/api/auth/logout')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    const clearedCookie = res.headers['set-cookie']?.[0] ?? '';
    expect(clearedCookie).toContain('token=;');
  });
});

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import { cleanDatabase, mintAuthCookie, createOrganizer, createUser } from '../test/helpers';

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── GET /api/organizers/me/team ─────────────────────────────────────────────

describe('GET /api/organizers/me/team', () => {
  it('returns 401 when not logged in', async () => {
    const res = await request(app).get('/api/organizers/me/team');

    expect(res.status).toBe(401);
  });

  it('returns 403 for a regular user', async () => {
    const user   = await createUser();
    const cookie = mintAuthCookie(user.id, 'USER');

    const res = await request(app)
      .get('/api/organizers/me/team')
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
  });

  it('returns an empty team when no teammates have been added', async () => {
    const organizer = await createOrganizer();
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .get('/api/organizers/me/team')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.team).toEqual([]);
  });

  it('returns the team members when teammates exist', async () => {
    const organizer = await createOrganizer();
    const teammate  = await createUser({ email: 'teammate@test.com', name: 'Team Member' });
    await prisma.organizerMember.create({
      data: { userId: teammate.id, organizerId: organizer.id },
    });
    const cookie = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .get('/api/organizers/me/team')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.team).toHaveLength(1);
    expect(res.body.team[0].email).toBe('teammate@test.com');
    expect(res.body.team[0].name).toBe('Team Member');
  });
});

// ─── POST /api/organizers/me/team ────────────────────────────────────────────

describe('POST /api/organizers/me/team', () => {
  it('returns 401 when not logged in', async () => {
    const res = await request(app)
      .post('/api/organizers/me/team')
      .send({ email: 'someone@test.com' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for a regular user', async () => {
    const user   = await createUser();
    const cookie = mintAuthCookie(user.id, 'USER');

    const res = await request(app)
      .post('/api/organizers/me/team')
      .set('Cookie', cookie)
      .send({ email: 'someone@test.com' });

    expect(res.status).toBe(403);
  });

  it('returns 400 when email is missing', async () => {
    const organizer = await createOrganizer();
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post('/api/organizers/me/team')
      .set('Cookie', cookie)
      .send({});

    expect(res.status).toBe(400);
  });

  it('returns 404 when the email does not match any user', async () => {
    const organizer = await createOrganizer();
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post('/api/organizers/me/team')
      .set('Cookie', cookie)
      .send({ email: 'nobody@test.com' });

    expect(res.status).toBe(404);
  });

  it('returns 400 when the organizer tries to add themselves', async () => {
    const organizer = await createOrganizer();
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post('/api/organizers/me/team')
      .set('Cookie', cookie)
      .send({ email: organizer.email });

    expect(res.status).toBe(400);
  });

  it('returns 409 when the user is already on the team', async () => {
    const organizer = await createOrganizer();
    const teammate  = await createUser({ email: 'teammate@test.com' });
    await prisma.organizerMember.create({
      data: { userId: teammate.id, organizerId: organizer.id },
    });
    const cookie = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post('/api/organizers/me/team')
      .set('Cookie', cookie)
      .send({ email: 'teammate@test.com' });

    expect(res.status).toBe(409);
  });

  it('adds the teammate and returns their details', async () => {
    const organizer = await createOrganizer();
    const newMember = await createUser({ email: 'newmember@test.com', name: 'New Member' });
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post('/api/organizers/me/team')
      .set('Cookie', cookie)
      .send({ email: 'newmember@test.com' });

    expect(res.status).toBe(201);
    expect(res.body.id).toBe(newMember.id);
    expect(res.body.email).toBe('newmember@test.com');

    // Confirm the row exists in the database
    const membership = await prisma.organizerMember.findUnique({
      where: { userId_organizerId: { userId: newMember.id, organizerId: organizer.id } },
    });
    expect(membership).not.toBeNull();
  });
});

// ─── DELETE /api/organizers/me/team/:userId ───────────────────────────────────

describe('DELETE /api/organizers/me/team/:userId', () => {
  it('returns 404 when the user is not on the team', async () => {
    const organizer = await createOrganizer();
    const stranger  = await createUser({ email: 'stranger@test.com' });
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .delete(`/api/organizers/me/team/${stranger.id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('removes the teammate and confirms they are gone', async () => {
    const organizer = await createOrganizer();
    const teammate  = await createUser({ email: 'teammate@test.com' });
    await prisma.organizerMember.create({
      data: { userId: teammate.id, organizerId: organizer.id },
    });
    const cookie = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .delete(`/api/organizers/me/team/${teammate.id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const membership = await prisma.organizerMember.findUnique({
      where: { userId_organizerId: { userId: teammate.id, organizerId: organizer.id } },
    });
    expect(membership).toBeNull();
  });
});

// ─── GET /api/organizers/:slug (viewerIsTeamMember) ──────────────────────────

describe('GET /api/organizers/:slug', () => {
  it('returns 404 for an unknown slug', async () => {
    const res = await request(app).get('/api/organizers/no-such-slug');

    expect(res.status).toBe(404);
  });

  it('viewerIsTeamMember is false for an unauthenticated visitor', async () => {
    await createOrganizer({ slug: 'test-org' });

    const res = await request(app).get('/api/organizers/test-org');

    expect(res.status).toBe(200);
    expect(res.body.organizer.viewerIsTeamMember).toBe(false);
  });

  it('viewerIsTeamMember is false for a logged-in user who is not on the team', async () => {
    await createOrganizer({ slug: 'test-org' });
    const stranger = await createUser({ email: 'stranger@test.com' });
    const cookie   = mintAuthCookie(stranger.id, 'USER');

    const res = await request(app)
      .get('/api/organizers/test-org')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.organizer.viewerIsTeamMember).toBe(false);
  });

  it('viewerIsTeamMember is true for a teammate', async () => {
    const organizer = await createOrganizer({ slug: 'test-org' });
    const teammate  = await createUser({ email: 'teammate@test.com' });
    await prisma.organizerMember.create({
      data: { userId: teammate.id, organizerId: organizer.id },
    });
    const cookie = mintAuthCookie(teammate.id, 'USER');

    const res = await request(app)
      .get('/api/organizers/test-org')
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.organizer.viewerIsTeamMember).toBe(true);
  });
});

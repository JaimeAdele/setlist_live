import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import {
  cleanDatabase,
  mintAuthCookie,
  createOrganizer,
  createUser,
  createEvent,
  createRoom,
} from '../test/helpers';

// Routes that add/remove songs or change room status emit Socket.io events.
// There's no real server in tests, so we replace getIO() with a no-op fake.
vi.mock('../lib/socket', () => ({
  getIO: () => ({ to: () => ({ emit: vi.fn() }) }),
}));

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

// ─── POST /api/events ─────────────────────────────────────────────────────────

describe('POST /api/events', () => {
  it('returns 401 when not logged in', async () => {
    const res = await request(app)
      .post('/api/events')
      .send({ name: 'Test Event', startTime: new Date().toISOString() });

    expect(res.status).toBe(401);
  });

  it('returns 403 for a regular user (not an organizer)', async () => {
    const user   = await createUser();
    const cookie = mintAuthCookie(user.id, 'USER');

    const res = await request(app)
      .post('/api/events')
      .set('Cookie', cookie)
      .send({ name: 'Test Event', startTime: new Date().toISOString() });

    expect(res.status).toBe(403);
  });

  it('returns 400 when name is missing', async () => {
    const organizer = await createOrganizer();
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post('/api/events')
      .set('Cookie', cookie)
      .send({ startTime: new Date().toISOString() });

    expect(res.status).toBe(400);
  });

  it('returns 400 when startTime is missing', async () => {
    const organizer = await createOrganizer();
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post('/api/events')
      .set('Cookie', cookie)
      .send({ name: 'Test Event' });

    expect(res.status).toBe(400);
  });

  it('creates an event and auto-creates one room named after the event', async () => {
    const organizer = await createOrganizer();
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post('/api/events')
      .set('Cookie', cookie)
      .send({ name: 'Friday Night', startTime: new Date().toISOString() });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Friday Night');
    expect(res.body.rooms).toHaveLength(1);
    expect(res.body.rooms[0].name).toBe('Friday Night');
    expect(res.body.rooms[0]).toHaveProperty('roomCode');
  });

  it('creates named rooms when a rooms array is provided', async () => {
    const organizer = await createOrganizer();
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post('/api/events')
      .set('Cookie', cookie)
      .send({ name: 'Festival', startTime: new Date().toISOString(), rooms: ['Stage A', 'Stage B'] });

    expect(res.status).toBe(201);
    expect(res.body.rooms).toHaveLength(2);
    const roomNames = res.body.rooms.map((r: { name: string }) => r.name);
    expect(roomNames).toContain('Stage A');
    expect(roomNames).toContain('Stage B');
  });
});

// ─── DELETE /api/events/:id ───────────────────────────────────────────────────

describe('DELETE /api/events/:id', () => {
  it('returns 404 for an unknown event id', async () => {
    const organizer = await createOrganizer();
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .delete('/api/events/nonexistent-id')
      .set('Cookie', cookie);

    expect(res.status).toBe(404);
  });

  it('returns 403 when a different organizer tries to delete', async () => {
    const owner    = await createOrganizer({ email: 'owner@test.com' });
    const intruder = await createOrganizer({ email: 'intruder@test.com' });
    const event    = await createEvent(owner.id);
    const cookie   = mintAuthCookie(intruder.id, 'ORGANIZER');

    const res = await request(app)
      .delete(`/api/events/${event.id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(403);
  });

  it('allows the owner to delete their own event', async () => {
    const organizer = await createOrganizer();
    const event     = await createEvent(organizer.id);
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .delete(`/api/events/${event.id}`)
      .set('Cookie', cookie);

    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);

    const deleted = await prisma.event.findUnique({ where: { id: event.id } });
    expect(deleted).toBeNull();
  });
});

// ─── POST /api/events/:id/rooms ───────────────────────────────────────────────

describe('POST /api/events/:id/rooms', () => {
  it('returns 403 when a different organizer tries to add a room', async () => {
    const owner    = await createOrganizer({ email: 'owner@test.com' });
    const intruder = await createOrganizer({ email: 'intruder@test.com' });
    const event    = await createEvent(owner.id);
    const cookie   = mintAuthCookie(intruder.id, 'ORGANIZER');

    const res = await request(app)
      .post(`/api/events/${event.id}/rooms`)
      .set('Cookie', cookie)
      .send({ name: 'New Room' });

    expect(res.status).toBe(403);
  });

  it('allows the owner to add a room', async () => {
    const organizer = await createOrganizer();
    const event     = await createEvent(organizer.id);
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post(`/api/events/${event.id}/rooms`)
      .set('Cookie', cookie)
      .send({ name: 'VIP Room' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('VIP Room');
    expect(res.body).toHaveProperty('roomCode');
  });
});

// ─── POST /api/events/:id/rooms/:roomId/songs ─────────────────────────────────

describe('POST /api/events/:id/rooms/:roomId/songs', () => {
  it('returns 401 when not logged in', async () => {
    const organizer = await createOrganizer();
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id, { status: 'ACTIVE' });

    const res = await request(app)
      .post(`/api/events/${event.id}/rooms/${room.id}/songs`)
      .send({ title: 'Test Song', artist: 'Test Artist' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for an unrelated user', async () => {
    const organizer = await createOrganizer();
    const stranger  = await createUser({ email: 'stranger@test.com' });
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id, { status: 'ACTIVE' });
    const cookie    = mintAuthCookie(stranger.id, 'USER');

    const res = await request(app)
      .post(`/api/events/${event.id}/rooms/${room.id}/songs`)
      .set('Cookie', cookie)
      .send({ title: 'Test Song', artist: 'Test Artist' });

    expect(res.status).toBe(403);
  });

  it('returns 403 when the room is not active', async () => {
    const organizer = await createOrganizer();
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id, { status: 'UPCOMING' });
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post(`/api/events/${event.id}/rooms/${room.id}/songs`)
      .set('Cookie', cookie)
      .send({ title: 'Test Song', artist: 'Test Artist' });

    expect(res.status).toBe(403);
  });

  it('allows the organizer to add a song to an active room', async () => {
    const organizer = await createOrganizer();
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id, { status: 'ACTIVE' });
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .post(`/api/events/${event.id}/rooms/${room.id}/songs`)
      .set('Cookie', cookie)
      .send({ title: 'Levitating', artist: 'Dua Lipa' });

    expect(res.status).toBe(201);
    expect(res.body.title).toBe('Levitating');
    expect(res.body.artist).toBe('Dua Lipa');
    expect(res.body.roomId).toBe(room.id);
  });
});

// ─── PATCH /api/events/:id/rooms/:roomId/status ───────────────────────────────

describe('PATCH /api/events/:id/rooms/:roomId/status', () => {
  it('returns 400 for an invalid status value', async () => {
    const organizer = await createOrganizer();
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id);
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .patch(`/api/events/${event.id}/rooms/${room.id}/status`)
      .set('Cookie', cookie)
      .send({ status: 'INVALID' });

    expect(res.status).toBe(400);
  });

  it('returns 403 for a different organizer', async () => {
    const owner    = await createOrganizer({ email: 'owner@test.com' });
    const intruder = await createOrganizer({ email: 'intruder@test.com' });
    const event    = await createEvent(owner.id);
    const room     = await createRoom(event.id);
    const cookie   = mintAuthCookie(intruder.id, 'ORGANIZER');

    const res = await request(app)
      .patch(`/api/events/${event.id}/rooms/${room.id}/status`)
      .set('Cookie', cookie)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(403);
  });

  it('allows the owner to change room status', async () => {
    const organizer = await createOrganizer();
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id);
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .patch(`/api/events/${event.id}/rooms/${room.id}/status`)
      .set('Cookie', cookie)
      .send({ status: 'ACTIVE' });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ACTIVE');
  });
});

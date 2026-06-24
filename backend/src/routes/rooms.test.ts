import { describe, it, expect, beforeEach, afterAll } from 'vitest';
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

beforeEach(async () => {
  await cleanDatabase();
});

afterAll(async () => {
  await prisma.$disconnect();
});

describe('GET /api/rooms/:roomCode/setlist', () => {
  it('returns 404 for an unknown room code', async () => {
    const res = await request(app).get('/api/rooms/XXXXXX/setlist');

    expect(res.status).toBe(404);
  });

  it('returns the correct response shape for a valid room', async () => {
    const organizer = await createOrganizer();
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id);

    const res = await request(app).get(`/api/rooms/${room.roomCode}/setlist`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('room');
    expect(res.body).toHaveProperty('event');
    expect(res.body).toHaveProperty('songs');
    expect(res.body).toHaveProperty('isPrivileged');
    expect(res.body.room.roomCode).toBe(room.roomCode);
    expect(res.body.event.name).toBe('Test Event');
    expect(Array.isArray(res.body.songs)).toBe(true);
  });

  // ─── isPrivileged paths ──────────────────────────────────────────────────────
  // canManageEvent has four branches: no user, admin, organizer, teammate.
  // The DJ check is separate (done in the route itself). We test all of them.

  it('isPrivileged is false for an unauthenticated request', async () => {
    const organizer = await createOrganizer();
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id);

    const res = await request(app).get(`/api/rooms/${room.roomCode}/setlist`);

    expect(res.body.isPrivileged).toBe(false);
  });

  it('isPrivileged is true for the organizer', async () => {
    const organizer = await createOrganizer();
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id);
    const cookie    = mintAuthCookie(organizer.id, 'ORGANIZER');

    const res = await request(app)
      .get(`/api/rooms/${room.roomCode}/setlist`)
      .set('Cookie', cookie);

    expect(res.body.isPrivileged).toBe(true);
  });

  it('isPrivileged is true for an organizer teammate', async () => {
    const organizer = await createOrganizer();
    const teammate  = await createUser({ email: 'teammate@test.com' });
    await prisma.organizerMember.create({
      data: { userId: teammate.id, organizerId: organizer.id },
    });
    const event  = await createEvent(organizer.id);
    const room   = await createRoom(event.id);
    const cookie = mintAuthCookie(teammate.id, 'USER');

    const res = await request(app)
      .get(`/api/rooms/${room.roomCode}/setlist`)
      .set('Cookie', cookie);

    expect(res.body.isPrivileged).toBe(true);
  });

  it('isPrivileged is true for an assigned DJ', async () => {
    const organizer = await createOrganizer();
    const dj        = await createUser({ email: 'dj@test.com' });
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id);
    await prisma.roomDJ.create({ data: { roomId: room.id, userId: dj.id } });
    const cookie = mintAuthCookie(dj.id, 'USER');

    const res = await request(app)
      .get(`/api/rooms/${room.roomCode}/setlist`)
      .set('Cookie', cookie);

    expect(res.body.isPrivileged).toBe(true);
  });

  it('isPrivileged is false for an unrelated logged-in user', async () => {
    const organizer = await createOrganizer();
    const stranger  = await createUser({ email: 'stranger@test.com' });
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id);
    const cookie    = mintAuthCookie(stranger.id, 'USER');

    const res = await request(app)
      .get(`/api/rooms/${room.roomCode}/setlist`)
      .set('Cookie', cookie);

    expect(res.body.isPrivileged).toBe(false);
  });

  // ─── Songs and reactions ─────────────────────────────────────────────────────

  it('songs include a reaction breakdown with correct counts', async () => {
    const organizer = await createOrganizer();
    const event     = await createEvent(organizer.id);
    const room      = await createRoom(event.id);
    await prisma.song.create({
      data: {
        roomId: room.id,
        title:  'Test Song',
        artist: 'Test Artist',
        reactions: {
          create: [
            { voterId: 'voter-1', emoji: '🔥', value: 10 },
            { voterId: 'voter-2', emoji: '🔥', value: 10 },
            { voterId: 'voter-3', emoji: '🥱', value: -5 },
          ],
        },
      },
    });

    const res = await request(app).get(`/api/rooms/${room.roomCode}/setlist`);

    expect(res.body.songs).toHaveLength(1);
    expect(res.body.songs[0].breakdown['🔥']).toBe(2);
    expect(res.body.songs[0].breakdown['🥱']).toBe(1);
    expect(res.body.songs[0].breakdown['❤️']).toBe(0);
  });
});

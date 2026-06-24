import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import request from 'supertest';
import app from '../app';
import prisma from '../lib/prisma';
import redis from '../lib/redis';
import { cleanDatabase, cleanRedis, createOrganizer, createEvent, createRoom } from '../test/helpers';

vi.mock('../lib/socket', () => ({
  getIO: () => ({ to: () => ({ emit: vi.fn() }) }),
}));

beforeEach(async () => {
  await cleanDatabase();
  await cleanRedis();
});

afterAll(async () => {
  await prisma.$disconnect();
  await redis.quit();
});

// ─── helpers ──────────────────────────────────────────────────────────────────

async function createActiveSong(overrides: { identifiedAt?: Date } = {}) {
  const organizer = await createOrganizer();
  const event     = await createEvent(organizer.id);
  const room      = await createRoom(event.id, { status: 'ACTIVE' });
  const song      = await prisma.song.create({
    data: {
      roomId:       room.id,
      title:        'Test Song',
      artist:       'Test Artist',
      identifiedAt: overrides.identifiedAt ?? new Date(),
    },
  });
  return { song, room };
}

// ─── POST /api/songs/:id/react ────────────────────────────────────────────────

describe('POST /api/songs/:id/react', () => {
  it('returns 400 for an invalid emoji', async () => {
    const { song } = await createActiveSong();

    const res = await request(app)
      .post(`/api/songs/${song.id}/react`)
      .send({ emoji: '👍' });

    expect(res.status).toBe(400);
  });

  it('returns 404 for an unknown song id', async () => {
    const res = await request(app)
      .post('/api/songs/nonexistent-id/react')
      .send({ emoji: '🔥' });

    expect(res.status).toBe(404);
  });

  it('returns 403 when the voting window has closed', async () => {
    // Create a song whose identifiedAt is 16 minutes in the past
    const sixteenMinutesAgo = new Date(Date.now() - 16 * 60 * 1000);
    const { song } = await createActiveSong({ identifiedAt: sixteenMinutesAgo });

    const res = await request(app)
      .post(`/api/songs/${song.id}/react`)
      .send({ emoji: '🔥' });

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/window/i);
  });

  it('saves the reaction and returns the correct vibe score and breakdown', async () => {
    const { song } = await createActiveSong();

    const res = await request(app)
      .post(`/api/songs/${song.id}/react`)
      .send({ emoji: '🔥' });

    expect(res.status).toBe(200);
    expect(res.body.vibeScore).toBe(10);
    expect(res.body.reactionCount).toBe(1);
    expect(res.body.breakdown['🔥']).toBe(1);
    expect(res.body.breakdown['❤️']).toBe(0);
  });

  it('replaces the reaction when the same voter reacts again with a different emoji', async () => {
    const { song } = await createActiveSong();
    const voterId  = 'test-voter-id';

    // First reaction: 🔥
    await request(app)
      .post(`/api/songs/${song.id}/react`)
      .set('Cookie', `voter_id=${voterId}`)
      .send({ emoji: '🔥' });

    // Change to ❤️ — should replace, not add
    const res = await request(app)
      .post(`/api/songs/${song.id}/react`)
      .set('Cookie', `voter_id=${voterId}`)
      .send({ emoji: '❤️' });

    expect(res.status).toBe(200);
    expect(res.body.vibeScore).toBe(5);   // ❤️ = 5, not 15 (🔥 + ❤️)
    expect(res.body.reactionCount).toBe(1); // still 1 reaction, not 2
    expect(res.body.breakdown['🔥']).toBe(0);
    expect(res.body.breakdown['❤️']).toBe(1);

    // Confirm there's exactly one reaction row in the database
    const reactions = await prisma.reaction.findMany({ where: { songId: song.id } });
    expect(reactions).toHaveLength(1);
    expect(reactions[0].emoji).toBe('❤️');
  });

  it('returns 429 after more than 10 reactions by the same voter', async () => {
    const { song } = await createActiveSong();
    const voterId  = 'rate-limit-test-voter';

    // Send 10 reactions — all should succeed
    for (let i = 0; i < 10; i++) {
      const res = await request(app)
        .post(`/api/songs/${song.id}/react`)
        .set('Cookie', `voter_id=${voterId}`)
        .send({ emoji: '🔥' });
      expect(res.status).toBe(200);
    }

    // 11th should be blocked
    const res = await request(app)
      .post(`/api/songs/${song.id}/react`)
      .set('Cookie', `voter_id=${voterId}`)
      .send({ emoji: '🔥' });

    expect(res.status).toBe(429);
  });
});

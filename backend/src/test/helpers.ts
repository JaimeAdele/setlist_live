import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import redis from '../lib/redis';

export async function cleanRedis() {
  await redis.flushdb();
}

export async function cleanDatabase() {
  await prisma.reaction.deleteMany();
  await prisma.song.deleteMany();
  await prisma.roomDJ.deleteMany();
  await prisma.organizerMember.deleteMany();
  await prisma.room.deleteMany();
  await prisma.event.deleteMany();
  await prisma.venue.deleteMany();
  await prisma.user.deleteMany();
}

// Mint a JWT and format it as a cookie string, bypassing the login flow.
// Use this in tests that aren't testing auth itself — it's much faster than
// calling /api/auth/login because it skips bcrypt entirely.
export function mintAuthCookie(userId: string, role: string): string {
  const token = jwt.sign({ userId, role }, process.env.JWT_SECRET!, { expiresIn: '7d' });
  return `token=${token}`;
}

// ─── Factory helpers ───────────────────────────────────────────────────────────
// Create test records with sensible defaults. Pass overrides to customise.

export async function createOrganizer(overrides: { email?: string; name?: string; slug?: string } = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? 'organizer@test.com',
      name:  overrides.name  ?? 'Test Organizer',
      role:  'ORGANIZER',
      slug:  overrides.slug,
    },
  });
}

export async function createUser(overrides: { email?: string; name?: string } = {}) {
  return prisma.user.create({
    data: {
      email: overrides.email ?? 'user@test.com',
      name:  overrides.name  ?? 'Test User',
    },
  });
}

export async function createEvent(organizerId: string, overrides: { name?: string } = {}) {
  return prisma.event.create({
    data: {
      name:        overrides.name ?? 'Test Event',
      startTime:   new Date(),
      organizerId,
    },
  });
}

export async function createRoom(
  eventId: string,
  overrides: { roomCode?: string; name?: string; status?: 'UPCOMING' | 'ACTIVE' | 'CLOSED' } = {}
) {
  return prisma.room.create({
    data: {
      name:     overrides.name     ?? 'Test Room',
      roomCode: overrides.roomCode ?? 'TESTCD',
      status:   overrides.status   ?? 'UPCOMING',
      eventId,
    },
  });
}

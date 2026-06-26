import { Router, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import prisma from '../lib/prisma';
import { requireAuth, requireAdmin, requireOrganizer, optionalAuth } from '../middleware/auth';

const SLUG_BLOCKLIST = ['admin', 'api', 'auth', 'login'];
const SLUG_PATTERN = /^[a-z0-9-]{3,40}$/;

const router = Router();

// GET /api/organizers — public; list all organizers with active event count
router.get('/', async (_req, res) => {
  const organizers = await prisma.user.findMany({
    where: { role: 'ORGANIZER' },
    select: {
      id: true,
      name: true,
      slug: true,
      events: {
        where: { rooms: { some: { status: { in: ['ACTIVE', 'UPCOMING'] } } } },
        select: { id: true },
      },
    },
    orderBy: { name: 'asc' },
  });

  const result = organizers.map((org) => ({
    id: org.id,
    name: org.name,
    slug: org.slug,
    activeEventCount: org.events.length,
  }));

  res.json({ organizers: result });
});

// GET /api/organizers/me/team — list my teammates
router.get('/me/team', requireAuth, requireOrganizer, async (req: Request, res: Response) => {
  const members = await prisma.organizerMember.findMany({
    where: { organizerId: req.user!.userId },
    include: { user: { select: { id: true, name: true, email: true } } },
    orderBy: { addedAt: 'asc' },
  });

  res.json({ team: members.map(m => ({ ...m.user, addedAt: m.addedAt })) });
});

// POST /api/organizers/me/team — add a teammate by email
router.post('/me/team', requireAuth, requireOrganizer, async (req: Request, res: Response) => {
  const { email } = req.body;

  if (!email || typeof email !== 'string') {
    res.status(400).json({ error: 'email is required' });
    return;
  }

  try {
    const target = await prisma.user.findUnique({
      where: { email: email.trim().toLowerCase() },
      select: { id: true, name: true, email: true },
    });

    if (!target) {
      res.status(404).json({ error: "No account found with that email. They'll need to sign up first." });
      return;
    }

    if (target.id === req.user!.userId) {
      res.status(400).json({ error: "You can't add yourself to your own team." });
      return;
    }

    const member = await prisma.organizerMember.create({
      data: { userId: target.id, organizerId: req.user!.userId },
    });

    res.status(201).json({ id: target.id, name: target.name, email: target.email, addedAt: member.addedAt });
  } catch (e: any) {
    if (e?.code === 'P2002') {
      res.status(409).json({ error: 'That person is already on your team.' });
      return;
    }
    res.status(500).json({ error: 'Failed to add teammate' });
  }
});

// DELETE /api/organizers/me/team/:userId — remove a teammate
router.delete('/me/team/:userId', requireAuth, requireOrganizer, async (req: Request, res: Response) => {
  try {
    await prisma.organizerMember.delete({
      where: {
        userId_organizerId: { userId: req.params.userId, organizerId: req.user!.userId },
      },
    });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: 'Teammate not found' });
  }
});

// GET /api/organizers/:slug — public; organizer info + their events with rooms
router.get('/:slug', optionalAuth, async (req, res) => {
  const { slug } = req.params;

  const organizer = await prisma.user.findUnique({
    where: { slug },
    select: {
      id: true,
      name: true,
      slug: true,
      events: {
        orderBy: { startTime: 'desc' },
        select: {
          id: true,
          name: true,
          startTime: true,
          venueId: true,
          recurrenceFrequency: true,
          recurrenceDayOfWeek: true,
          recurrenceDayPosition: true,
          venue: { select: { id: true, name: true, address: true } },
          rooms: {
            select: {
              id: true,
              name: true,
              roomCode: true,
              status: true,
              djs: {
                select: { user: { select: { id: true, name: true } } },
              },
            },
          },
        },
      },
    },
  });

  if (!organizer) {
    res.status(404).json({ error: 'Organizer not found' });
    return;
  }

  const viewerId = req.user?.userId;
  const viewerIsTeamMember = !!(
    viewerId &&
    viewerId !== organizer.id &&
    await prisma.organizerMember.findUnique({
      where: { userId_organizerId: { userId: viewerId, organizerId: organizer.id } },
    })
  );

  res.json({ organizer: { ...organizer, viewerIsTeamMember } });
});

// PATCH /api/organizers/:id — admin only; edit organizer account fields
router.patch('/:id', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  const { id } = req.params;
  const { name, email, slug, password } = req.body;

  if (slug !== undefined) {
    if (!SLUG_PATTERN.test(slug)) {
      res.status(400).json({ error: 'Slug must be 3–40 characters: lowercase letters, digits, and hyphens only' });
      return;
    }
    if (SLUG_BLOCKLIST.includes(slug)) {
      res.status(400).json({ error: `'${slug}' is a reserved slug and cannot be used` });
      return;
    }
  }

  try {
    const data: Record<string, unknown> = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;
    if (slug !== undefined) data.slug = slug;
    if (password) data.passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.update({
      where: { id },
      data,
      select: { id: true, name: true, email: true, slug: true },
    });
    res.json(user);
  } catch {
    res.status(409).json({ error: 'Email or slug already in use' });
  }
});

export default router;

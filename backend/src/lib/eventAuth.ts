import prisma from './prisma';

export async function canManageEvent(
  user: Express.User | undefined,
  organizerId: string
): Promise<boolean> {
  if (!user) return false;
  if (user.role === 'ADMIN') return true;
  if (user.userId === organizerId) return true;
  const membership = await prisma.organizerMember.findUnique({
    where: { userId_organizerId: { userId: user.userId, organizerId } },
  });
  return !!membership;
}

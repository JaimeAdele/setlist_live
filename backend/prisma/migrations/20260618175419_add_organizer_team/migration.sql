-- CreateTable
CREATE TABLE "OrganizerMember" (
    "userId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizerMember_userId_organizerId_key" ON "OrganizerMember"("userId", "organizerId");

-- RenameForeignKey
ALTER TABLE "Event" RENAME CONSTRAINT "Event_operatorId_fkey" TO "Event_organizerId_fkey";

-- AddForeignKey
ALTER TABLE "OrganizerMember" ADD CONSTRAINT "OrganizerMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizerMember" ADD CONSTRAINT "OrganizerMember_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

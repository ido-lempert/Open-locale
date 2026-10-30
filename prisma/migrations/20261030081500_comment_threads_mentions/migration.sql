-- Comment threading: optional self-reference; deleting a parent cascades to
-- its replies (a reply without its context would be misleading).
ALTER TABLE "comments" ADD COLUMN "parentId" uuid;
ALTER TABLE "comments" ADD CONSTRAINT "comments_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "comments_parentId_idx" ON "comments"("parentId");

-- Resolved @email mentions on comments (project members only).
CREATE TABLE "comment_mentions" (
  "commentId" uuid NOT NULL,
  "userId" uuid NOT NULL,
  CONSTRAINT "comment_mentions_pkey" PRIMARY KEY ("commentId", "userId"),
  CONSTRAINT "comment_mentions_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "comment_mentions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- Backfill: rows that already have a real title (not the default placeholder)
-- are considered "titled" and must not be overwritten by auto-naming.
-- Rows still carrying the default title remain false so auto-naming fires once.
UPDATE "chats" SET "titled" = true WHERE "title" <> 'New Chat';

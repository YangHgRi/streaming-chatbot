import 'dotenv/config';
import type { Config } from 'drizzle-kit';

// U2: provide a clear error when DATABASE_URL is missing so developers
// get an actionable message from 'npm run db:migrate' instead of a
// cryptic connection failure from drizzle-kit internals.
const url = process.env.DATABASE_URL;
if (!url) {
  throw new Error(
    'DATABASE_URL is not set.\n' +
    'Copy .env.local.example to .env.local and fill in the value before running migrations.',
  );
}

export default {
  schema: './src/lib/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: { url },
} satisfies Config;

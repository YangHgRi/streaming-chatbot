import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

const globalForDb = globalThis as unknown as {
  db: ReturnType<typeof drizzle> | undefined;
};

const client = globalForDb.db
  ? null
  : postgres(process.env.DATABASE_URL!, { max: 10 });

export const db =
  globalForDb.db ??
  drizzle(client!, { schema });

if (process.env.NODE_ENV !== 'production') {
  globalForDb.db = db;
}

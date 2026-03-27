import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

// Issue #4: validate DATABASE_URL at startup for a clear error message
const url = process.env.DATABASE_URL;
if (!url) {
   throw new Error(
      'DATABASE_URL environment variable is not set. ' +
      'Copy .env.local.example to .env.local and fill in the value.',
   );
}

// Issue #10: carry the schema generic so query results are fully typed
type DbInstance = ReturnType<typeof drizzle<typeof schema>>;

const globalForDb = globalThis as unknown as {
   db: DbInstance | undefined;
};

export const db: DbInstance =
   globalForDb.db ??
   drizzle(postgres(url, { max: 10 }), { schema });

if (process.env.NODE_ENV !== 'production') {
   globalForDb.db = db;
}

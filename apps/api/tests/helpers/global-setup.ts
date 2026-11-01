import { startTestDatabase } from '../../../../packages/db/testing/embedded-postgres';

/** Throw-away PostgreSQL with the real migrations; DATABASE_URL is passed on to the test workers. */
export default async function setup() {
  const db = await startTestDatabase(54330);
  process.env.DATABASE_URL = db.url;
  return () => db.stop();
}

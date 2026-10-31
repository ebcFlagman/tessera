import { startTestDatabase } from '../../../packages/db/testing/embedded-postgres';

export default async function setup() {
  const db = await startTestDatabase(54331);
  process.env.DATABASE_URL = db.url;
  return () => db.stop();
}

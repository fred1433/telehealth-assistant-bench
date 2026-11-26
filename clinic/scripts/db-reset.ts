import { resetDatabase } from './db-lib';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}
resetDatabase(url)
  .then(() => console.log('database reset with fictional seed'))
  .catch((err) => {
    console.error('reset failed:', err.message);
    process.exit(1);
  });

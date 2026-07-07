import { defineConfig } from 'drizzle-kit';

// Generates plain SQLite migrations into ./migrations, which Wrangler applies to
// D1 via `wrangler d1 migrations apply` (no drizzle-kit push against D1 needed).
export default defineConfig({
	dialect: 'sqlite',
	schema: './src/lib/db/schema.ts',
	out: './migrations',
	strict: true,
	verbose: true,
});

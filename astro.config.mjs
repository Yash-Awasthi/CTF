// @ts-check
import { defineConfig, sessionDrivers } from 'astro/config';

import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

// https://astro.build/config
export default defineConfig({
  // Server-rendered app: auth, sessions and API routes run on demand.
  output: 'server',

  // We run our OWN D1-backed session system (src/lib/auth). Astro's built-in
  // sessions are unused, so pin an in-memory driver purely to stop the
  // Cloudflare adapter from auto-requiring a `SESSION` KV namespace binding.
  // (The adapter only forces the KV driver when `session.driver` is unset.)
  session: {
    driver: sessionDrivers.memory(),
  },

  integrations: [react()],

  vite: {
    plugins: [tailwindcss()],
  },

  // `passthrough` image service → no `IMAGES` binding required at deploy time.
  adapter: cloudflare({
    imageService: 'passthrough',
  }),
});

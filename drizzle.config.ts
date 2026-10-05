import { defineConfig } from "drizzle-kit";

import { existsSync } from "node:fs";

// On Vercel the vars come from the project settings; there is no .env.local.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");

export default defineConfig({
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});

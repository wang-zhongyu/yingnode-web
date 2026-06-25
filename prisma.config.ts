import { config as dotenvConfig } from "dotenv";
import { defineConfig } from "prisma/config";

// Explicitly load .env from the project root — Prisma's config loader
// may not execute side-effect imports (import "dotenv/config") reliably.
dotenvConfig();

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    url: process.env["DATABASE_URL"] ?? "file:/data/yingnode.db",
  },
});

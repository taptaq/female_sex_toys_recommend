import "dotenv/config";
import { defineConfig, env } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  datasource: {
    // Prisma v7 CLI (e.g. for migrations / db push) uses this config.
    // For Supabase, the CLI requires the direct connection (port 5432) to modify the schema.
    url: env("DIRECT_URL"),
  },
});

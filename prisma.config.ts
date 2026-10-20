// With a prisma.config.ts present the Prisma CLI no longer auto-loads .env,
// so load it here (existing environment variables still take precedence).
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});

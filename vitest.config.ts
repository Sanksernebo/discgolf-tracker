import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Point Prisma at a dedicated test database BEFORE any module import,
// so the singleton in src/lib/prisma.ts uses it.
// Prisma resolves relative sqlite paths against the schema's directory
// (prisma/), so `file:./test.db` → prisma/test.db on disk.
process.env.DATABASE_URL = "file:./test.db";
process.env.ADMIN_PASSWORD = "test-secret";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["./test/setup.ts"],
    include: ["test/**/*.test.ts"],
    // Serial to avoid SQLite write contention on the shared test DB.
    fileParallelism: false,
    pool: "forks",
  },
});

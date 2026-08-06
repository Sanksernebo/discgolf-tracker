import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Point Prisma at a dedicated test database BEFORE any module import,
// so the singleton in src/lib/prisma.ts uses it.
// Point Vitest at the isolated MySQL database created by docker-compose.
// The default matches the discgolf_test schema in docker/mysql-init.
// Override with TEST_DATABASE_URL if you're running MySQL somewhere else.
process.env.DATABASE_URL =
  process.env.TEST_DATABASE_URL ??
  "mysql://discgolf:dev@localhost:3306/discgolf_test";
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

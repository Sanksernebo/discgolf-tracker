/**
 * Production entry point PM2 runs on Zone (and any other Node.js host that
 * needs a single JS file to launch the app). Next.js's own `next start`
 * binary can't be used here because Zone's PM2 panel doesn't accept CLI
 * arguments — everything has to come from environment variables.
 *
 * HOSTNAME and PORT are loaded from `.env` (via @next/env, which is what
 * Next uses internally). Set HOSTNAME to the account's loopback IP from
 * myZone → Webhosting → System information; Apache's mod_proxy forwards
 * traffic there.
 */
// Resolve everything relative to this file, not to PM2's cwd. Zone's PM2
// panel doesn't guarantee the working directory, so relying on process.cwd()
// meant .env wasn't found and Next couldn't find the .next build output.
require("@next/env").loadEnvConfig(__dirname, false);

const { createServer } = require("http");
const nextModule = require("next");
const next = nextModule.default ?? nextModule;

const hostname = process.env.HOSTNAME || "127.0.0.1";
const port = Number.parseInt(process.env.PORT || "3000", 10);

const app = next({ dev: false, hostname, port, dir: __dirname });
const handle = app.getRequestHandler();

app
  .prepare()
  .then(() => {
    createServer((req, res) => handle(req, res)).listen(port, hostname, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to start Next.js:", err);
    process.exit(1);
  });

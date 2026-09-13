import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
if (existsSync(".env")) process.loadEnvFile(".env");
const prod = process.argv.includes("--production");
if (prod) {
  const backend = spawn(process.execPath, ["apps/api/dist/apps/api/src/main.js"], {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", AGM_API_PORT: process.env.PORT || "3000", AGM_FRONTEND_DIR: resolve("apps/web/out") },
  });
  process.on("SIGINT", () => backend.kill("SIGINT"));
  process.on("SIGTERM", () => backend.kill("SIGTERM"));
  backend.on("exit", code => { process.exitCode = code || 0; });
} else {
const api = spawn(
  process.execPath,
  prod
    ? ["apps/api/dist/apps/api/src/main.js"]
    : ["--import", "tsx", "apps/api/src/main.ts"],
  {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: prod ? "production" : "development" },
  },
);
const web = spawn(
  process.execPath,
  [
    "node_modules/next/dist/bin/next",
    prod ? "start" : "dev",
    "apps/web",
    "--port",
    process.env.PORT || "3000",
  ],
  {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: prod ? "production" : "development" },
  },
);
function stop() {
  api.kill("SIGTERM");
  web.kill("SIGTERM");
}
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
api.on("exit", (code) => {
  if (code) {
    web.kill();
    process.exitCode = code;
  }
});
web.on("exit", (code) => {
  api.kill();
  process.exitCode = code || 0;
});

}

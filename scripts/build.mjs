import { spawnSync } from "node:child_process";
for (const args of [
  ["node_modules/typescript/bin/tsc", "-p", "apps/api/tsconfig.json"],
  ["node_modules/next/dist/bin/next", "build", "apps/web"],
]) {
  const r = spawnSync(process.execPath, args, {
    stdio: "inherit",
    env: { ...process.env, NODE_ENV: "production", AGM_STATIC_EXPORT: "1" },
  });
  if (r.status) process.exit(r.status);
}

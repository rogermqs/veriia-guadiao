import { Store } from "../apps/api/src/store";
import { seedHealth } from "../apps/api/src/health";
import { seedDemo } from "../apps/api/src/seed";
import { randomBytes } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";
async function main() {
  if (existsSync(".env")) process.loadEnvFile(".env");
  let email = process.env.AGM_BOOTSTRAP_ADMIN_EMAIL,
    password = process.env.AGM_BOOTSTRAP_ADMIN_PASSWORD;
  if (!password) {
    email = "admin@veriia.local";
    password = randomBytes(18).toString("base64url");
    writeFileSync(
      ".env",
      `AGM_BOOTSTRAP_ADMIN_EMAIL=${email}\nAGM_BOOTSTRAP_ADMIN_PASSWORD=${password}\nAGM_PUBLIC_ORIGIN=http://localhost:3000\n`,
      { flag: "wx", mode: 0o600 },
    );
  }
  const s = new Store();
  await s.bootstrap(email!, password!);
  await seedDemo(s);
  await seedHealth(s);
  console.log(
    "Bootstrap e seed prontos. Credenciais locais em .env (não versionado).",
  );
  await s.close();
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

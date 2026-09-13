import { Store, uuid } from "../apps/api/src/store";
import * as argon2 from "argon2";
async function main() {
  const email = process.env.AGM_USER_EMAIL,
    password = process.env.AGM_USER_PASSWORD,
    role = process.env.AGM_USER_ROLE || "reader",
    name = process.env.AGM_USER_NAME || "Usuário";
  if (!email || !password || password.length < 12)
    throw Error(
      "Defina AGM_USER_EMAIL e AGM_USER_PASSWORD (12 caracteres ou mais).",
    );
  if (!["admin", "manager", "analyst", "reader"].includes(role))
    throw Error("Papel inválido.");
  const s = new Store();
  try {
    const old = (await s.db
        .prepare("SELECT id FROM users WHERE email=?")
        .get(email)) as any,
      id = old?.id || uuid();
    const passwordHash = await argon2.hash(password, { type: argon2.argon2id });
    await s.db.transaction(async () => {
      await s.db
        .prepare(
          "INSERT INTO users(id,email,password_hash,name) VALUES(?,?,?,?) ON CONFLICT(email) DO UPDATE SET password_hash=excluded.password_hash,name=excluded.name",
        )
        .run(id, email, passwordHash, name);
      await s.db.prepare("DELETE FROM sessions WHERE user_id=?").run(id);
      for (const w of ["demo", "real"])
        await s.db
          .prepare(
            "INSERT INTO memberships VALUES(?,?,?) ON CONFLICT(user_id,workspace_id) DO UPDATE SET role=excluded.role",
          )
          .run(id, w, role);
    })();
    console.log("Conta atualizada; sessões anteriores revogadas.");
  } finally {
    await s.close();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});

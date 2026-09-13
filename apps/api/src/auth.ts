import { randomBytes } from "node:crypto";
import * as argon2 from "argon2";
import { Store, hash, now } from "./store";
import { AppError } from "./errors";
export class Auth {
  attempts = new Map<
    string,
    {
      count: number;
      reset: number;
    }
  >();
  constructor(public store: Store) {}
  async login(email: string, password: string, ip: string) {
    const key = ip;
    const a = this.attempts.get(key) || {
      count: 0,
      reset: Date.now() + 900000,
    };
    if (a.reset < Date.now()) {
      a.count = 0;
      a.reset = Date.now() + 900000;
    }
    a.count++;
    this.attempts.set(key, a);
    if (a.count > 15)
      throw new AppError(
        "RATE_LIMITED",
        "Muitas tentativas. Aguarde 15 minutos.",
        429,
      );
    const user = (await this.store.db
      .prepare("SELECT * FROM users WHERE email=? AND active=1")
      .get(email.toLowerCase())) as any;
    const valid = user && (await argon2.verify(user.password_hash, password));
    if (!valid)
      throw new AppError(
        "INVALID_CREDENTIALS",
        "E-mail ou senha incorretos.",
        401,
      );
    this.attempts.delete(key);
    const token = randomBytes(32).toString("base64url");
    await this.store.db
      .prepare("INSERT INTO sessions VALUES(?,?,?)")
      .run(
        hash(token),
        user.id,
        new Date(Date.now() + 8 * 3600000).toISOString(),
      );
    await this.store.audit("", user.id, "auth.login");
    return { token, user: await this.identity(token) };
  }
  async identity(token: string | undefined) {
    if (!token)
      throw new AppError("AUTH_REQUIRED", "Entre para acessar o sistema.", 401);
    const user = (await this.store.db
      .prepare(
        "SELECT u.id,u.email,u.name FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.id_hash=? AND s.expires_at>? AND u.active=1",
      )
      .get(hash(token), now())) as any;
    if (!user)
      throw new AppError(
        "AUTH_REQUIRED",
        "Sua sessão expirou. Entre novamente.",
        401,
      );
    return {
      ...user,
      workspaces: await this.store.db
        .prepare(
          "SELECT w.*,m.role FROM workspaces w JOIN memberships m ON w.id=m.workspace_id WHERE m.user_id=?",
        )
        .all(user.id),
    };
  }
  authorize(user: any, w: string, roles?: string[]) {
    const membership = user.workspaces.find((m: any) => m.id === w);
    if (!membership)
      throw new AppError("RESOURCE_NOT_FOUND", "Espaço não encontrado.", 404);
    if (roles && !roles.includes(membership.role))
      throw new AppError("FORBIDDEN", "Seu perfil não permite esta ação.", 403);
    return membership;
  }
  async logout(token: string) {
    await this.store.db
      .prepare("DELETE FROM sessions WHERE id_hash=?")
      .run(hash(token));
  }
}

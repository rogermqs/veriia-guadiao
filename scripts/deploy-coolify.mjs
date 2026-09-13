import { pathToFileURL } from "node:url";

// Deliberately accepts the single-service compose used by Guardião only.
export function replaceImage(compose, image) {
  if (!/^[a-z0-9][a-z0-9./_-]*:[a-zA-Z0-9._-]+$/.test(image))
    throw Error("Imagem inválida; use registro/repositório:commit.");
  const services = compose.match(
    /^services:\s*\n([\s\S]*?)(?=^[^\s#]|$(?![\s\S]))/m,
  )?.[1];
  if (
    !services ||
    (services.match(/^  [\w-]+:\s*$/gm) || []).join("") !== "  web:"
  )
    throw Error("Deploy exige exatamente um serviço web.");
  if ((services.match(/^    image:.*$/gm) || []).length !== 1)
    throw Error("Imagem web não encontrada.");
  let changed = services.replace(/^    image:.*$/m, `    image: ${image}`);
  if (/^    pull_policy:/m.test(changed))
    changed = changed.replace(
      /^    pull_policy:.*$/m,
      "    pull_policy: always",
    );
  else
    changed = changed.replace(
      /^    image:.*$/m,
      `    image: ${image}\n    pull_policy: always`,
    );
  return compose.replace(services, changed);
}
export async function deploy(
  env = process.env,
  http = fetch,
  pause = (ms) => new Promise((r) => setTimeout(r, ms)),
) {
  for (const name of [
    "COOLIFY_API_URL",
    "COOLIFY_API_TOKEN",
    "COOLIFY_SERVICE_UUID",
    "GUARDIAO_IMAGE",
    "CIRCLE_SHA1",
    "GUARDIAO_PUBLIC_ORIGIN",
  ])
    if (!env[name]) throw Error(`Configure ${name}.`);
  if (!/^[a-f0-9]{40}$/.test(env.CIRCLE_SHA1))
    throw Error("Revisão Git inválida.");
  const api = new URL(env.COOLIFY_API_URL),
    origin = new URL(env.GUARDIAO_PUBLIC_ORIGIN);
  if (api.protocol !== "https:" || origin.protocol !== "https:")
    throw Error("URLs do pipeline exigem HTTPS.");
  if (!/^[a-zA-Z0-9]+$/.test(env.COOLIFY_SERVICE_UUID))
    throw Error("UUID inválido.");
  const root =
    api.href.replace(/\/$/, "") + "/services/" + env.COOLIFY_SERVICE_UUID;
  async function call(path = "", method = "GET", body) {
    const r = await http(root + path, {
      method,
      headers: {
        Authorization: "Bearer " + env.COOLIFY_API_TOKEN,
        "Content-Type": "application/json",
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
      signal: AbortSignal.timeout(30000),
      redirect: "error",
    });
    if (!r.ok) throw Error(`Coolify respondeu HTTP ${r.status} em ${method}.`);
    return r.json();
  }
  async function health() {
    try {
      const r = await http(new URL("/api/v1/health/ready", origin), {
        signal: AbortSignal.timeout(10000),
        cache: "no-store",
        redirect: "error",
      });
      return r.ok ? await r.json() : null;
    } catch {
      return null;
    }
  }
  async function waitReady(revision) {
    for (let i = 0; i < 100; i++) {
      const h = await health();
      if (h?.status === "ok" && (!revision || h.revision === revision)) {
        const login = await http(new URL("/login", origin), {
          signal: AbortSignal.timeout(10000),
          redirect: "error",
        }).catch(() => null);
        if (login?.ok && (await login.text()).includes("Guardião")) return;
      }
      await pause(3000);
    }
    throw Error("A revisão esperada não ficou saudável dentro do prazo.");
  }
  const previous = await call();
  const previousHealth = await health();
  const compose = previous.docker_compose_raw;
  if (typeof compose !== "string") throw Error("Compose indisponível. O token Coolify precisa de read:sensitive para preservar a configuração existente.");
  const next = replaceImage(
    compose,
    env.GUARDIAO_IMAGE + ":" + env.CIRCLE_SHA1,
  );
  // Patch does not deploy; restart preserves volumes and avoids Coolify's stop/prune action.
  let mutated = false;
  try {
    mutated = true;
    await call("", "PATCH", {
      docker_compose_raw: Buffer.from(next).toString("base64"),
    });
    await call("/restart", "POST");
    await waitReady(env.CIRCLE_SHA1);
    console.log(`Guardião publicado: ${env.CIRCLE_SHA1}.`);
  } catch (error) {
    if (mutated) {
      try {
        await call("", "PATCH", {
          docker_compose_raw: Buffer.from(compose).toString("base64"),
        });
        await call("/restart", "POST");
        await waitReady(previousHealth?.revision);
        console.error("Imagem anterior restaurada e saudável.");
      } catch {
        console.error(
          "Rollback não confirmado. Verifique o serviço Guardião no Coolify.",
        );
      }
    }
    throw error;
  }
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href)
  deploy().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });

import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { replaceImage, deploy } from "../scripts/deploy-coolify.mjs";
it("changes only the web image and pull policy, preserving database, secrets and volumes", () => {
  const old = readFileSync("infra/docker/compose.coolify.yaml", "utf8");
  const next = replaceImage(old, "ghcr.io/example/guardiao:abc");
  expect(next).toContain("    image: ghcr.io/example/guardiao:abc");
  expect(next).toContain("DATABASE_URL: ${DATABASE_URL}");
  expect(
    next
      .replace(
        "ghcr.io/example/guardiao:abc",
        old.match(/^    image: (.+)$/m)![1],
      )
      .replace("pull_policy: always", "pull_policy: never"),
  ).toBe(old);
  expect(() =>
    replaceImage(
      old.replace("  web:", "  db:\n    image: postgres\n  web:"),
      "x:1",
    ),
  ).toThrow(/exatamente/);
  expect(() => replaceImage(old, "x:1\n  db:")).toThrow();
});
it("rejects stale healthy releases and restores the previous compose on failure", async () => {
  const compose = readFileSync("infra/docker/compose.coolify.yaml", "utf8"),
    patches: string[] = [];
  let restarts = 0,
    rolledBack = false;
  const fake = async (url: any, options: any = {}) => {
    if (String(url).endsWith("/health/ready"))
      return Response.json({ status: "ok", revision: "old" });
    if (String(url).endsWith("/login")) return new Response("Guardião");
    if (options.method === "PATCH") {
      patches.push(
        Buffer.from(
          JSON.parse(options.body).docker_compose_raw,
          "base64",
        ).toString(),
      );
      if (patches.length === 2) rolledBack = true;
      return Response.json({});
    }
    if (String(url).endsWith("/restart")) {
      restarts++;
      return Response.json({});
    }
    return Response.json({ docker_compose_raw: compose });
  };
  await expect(
    deploy(
      {
        COOLIFY_API_URL: "https://coolify.test/api/v1",
        COOLIFY_API_TOKEN: "fake",
        COOLIFY_SERVICE_UUID: "abc",
        GUARDIAO_IMAGE: "ghcr.io/test/app",
        CIRCLE_SHA1: "a".repeat(40),
        GUARDIAO_PUBLIC_ORIGIN: "https://app.test",
      },
      fake,
      async () => {},
    ),
  ).rejects.toThrow(/revisão esperada/);
  expect(rolledBack).toBe(true);
  expect(patches[1]).toBe(compose);
  expect(restarts).toBe(2);
});

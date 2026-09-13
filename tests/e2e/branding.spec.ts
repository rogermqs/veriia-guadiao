import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
test("Guardião landing connects six areas and lights the Second Brain", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await expect(page.locator("body")).not.toContainText(/Comply/i);
  await expect(page.locator(".brain-connection")).toHaveCount(6);
  await page
    .locator(".second-brain-hero")
    .evaluate((el) =>
      el.getAnimations({ subtree: true }).forEach((a) => a.finish()),
    );
  await expect(page.locator(".brain-tissue")).toHaveCSS("opacity", "1");
  await expect(page.locator(".brain-connected")).toHaveCSS("opacity", "1");
  await page.locator('[data-open-product="guardiao"]').click();
  await expect(page.getByRole("dialog")).toContainText("Segundo Cérebro");
  await page
    .getByRole("button", { name: "Fechar detalhes do produto" })
    .click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".signal-pulse").first()).toHaveCSS(
    "animation-name",
    "none",
  );
  expect(errors).toEqual([]);
});
test("Second Brain pulses during a turn and settles after the answer", async ({
  page,
}) => {
  await page.goto("/login");
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(process.env.AGM_BOOTSTRAP_ADMIN_EMAIL!);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.AGM_BOOTSTRAP_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  let complete!: () => void;
  const done = new Promise<void>((r) => {
    complete = r;
  });
  await page.route(
    "**/api/v1/workspaces/demo/conversations**",
    async (route) => {
      const u = route.request().url();
      if (u.endsWith("/events")) {
        await done;
        await route.fulfill({
          contentType: "text/event-stream",
          body: "event: answer.ready\ndata: {}\n\n",
        });
        return;
      }
      let json: any = { items: [] };
      if (route.request().method() === "POST")
        json = u.endsWith("/turns")
          ? { turn_id: "visual-turn" }
          : { id: "visual-conversation" };
      else if (u.endsWith("/visual-conversation"))
        json = {
          turns: [
            {
              id: "visual-turn",
              message: "Consulta visual controlada",
              status: "completed",
              answer: {
                text: "Consulta concluída.",
                evidence_ids: [],
                queries: [],
                limitations: [],
              },
            },
          ],
        };
      await route.fulfill({ json });
    },
  );
  await page.getByRole("button", { name: "Assistente", exact: true }).click();
  await expect(page.locator(".second-brain-console")).toBeVisible();
  await page
    .getByLabel("Mensagem para o assistente")
    .fill("Consulta visual controlada");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.locator(".second-brain-console")).toHaveClass(
    /is-thinking/,
  );
  await expect(page.locator(".console-brain")).toHaveCSS(
    "animation-name",
    "brain-thinking",
  );
  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect(page.locator(".console-brain")).toHaveCSS(
    "animation-name",
    "none",
  );
  complete();
  await expect(page.locator(".answer-text")).toHaveText("Consulta concluída.");
  await expect(page.locator(".second-brain-console")).not.toHaveClass(
    /is-thinking/,
  );
  await expect(page.locator("body")).not.toContainText(/\bAGM\b/);
});

import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
test("login, filtered dashboard, persistent commitment, source, empty real workspace and logout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  await expect(
    page.getByRole("heading", { name: "Bem-vindo ao Guardião" }),
  ).toBeVisible();
  await page.screenshot({
    path: "docs/screenshots/login-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(process.env.AGM_BOOTSTRAP_ADMIN_EMAIL!);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.AGM_BOOTSTRAP_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(
    page.getByRole("heading", { name: "Visão geral", exact: true }),
  ).toBeVisible();
  await expect(page.locator(".metric-value").first()).not.toHaveText("");
  await page.screenshot({
    path: "docs/screenshots/painel-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Ver origem e filtros" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Fechar painel" }).click();
  await page.getByLabel("Bairro", { exact: true }).selectOption("Norte");
  await expect(page.locator(".bar-row")).toHaveCount(1);
  await page.getByRole("button", { name: "Compromissos", exact: true }).click();
  await page.getByRole("button", { name: "Novo compromisso" }).click();
  const title = "Plano de manutenção E2E " + Date.now();
  await page.getByLabel("Título", { exact: true }).fill(title);
  await page
    .getByRole("combobox", { name: "Secretaria", exact: true })
    .selectOption("Secretaria de Obras");
  await page.getByLabel("Prazo", { exact: true }).fill("2026-09-30");
  await page.getByRole("button", { name: "Salvar registro" }).click();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: title, exact: true }),
  ).toBeVisible();
  await page.getByLabel("Espaço de trabalho").selectOption("real");
  await expect(
    page.getByRole("heading", { name: "Uma base de dados é o primeiro passo" }),
  ).toBeVisible();
  await page.getByLabel("Espaço de trabalho").selectOption("demo");
  await page.getByRole("button", { name: "Conhecimento", exact: true }).click();
  await expect(page.locator(".document-row")).toHaveCount(12);
  await page.locator(".document-row").first().click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Fechar painel" }).click();
  await page.getByRole("button", { name: "Assistente", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "O que vamos entender hoje?" }),
  ).toBeVisible();
  // Paid-provider journeys are validated separately; keep this suite deterministic.
  if (!process.env.AGM_LLM_API_KEY) {
    await page
      .getByLabel("Mensagem para o assistente")
      .fill("Quantos registros existem?");
    await page.getByRole("button", { name: "Enviar mensagem" }).click();
    await expect(page.locator(".turn-error")).toContainText("provedor de IA");
  }
  await page.screenshot({
    path: "docs/screenshots/assistente-desktop.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.getByRole("button", { name: "Visão geral", exact: true }).click();
  await page.setViewportSize({ width: 1024, height: 900 });
  await page.screenshot({
    path: "docs/screenshots/painel-tablet.png",
    fullPage: true,
    animations: "disabled",
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(
    page.getByRole("button", { name: "Abrir navegação" }),
  ).toBeVisible();
  await expect(page.locator(".metric-value").first()).not.toHaveText("");
  await page.screenshot({
    path: "docs/screenshots/painel-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByRole("button", { name: "Abrir navegação" }).click();
  await page.getByRole("button", { name: "Sair do sistema" }).click();
  await expect(page).toHaveURL(/login/);
  await page.screenshot({
    path: "docs/screenshots/login-mobile.png",
    fullPage: true,
    animations: "disabled",
  });
  expect(errors).toEqual([]);
});

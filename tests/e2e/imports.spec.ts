import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
test("imports CSV in background, reviews quality and imports a commitment template", async ({
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
  await page
    .getByRole("button", { name: "Fontes e importações", exact: true })
    .click();
  await page
    .getByLabel("Arquivo de dados")
    .setInputFiles("packages/test-fixtures/demands-golden.csv");
  await page.getByLabel("Título da base").fill("Golden E2E · não ativar");
  await page.getByRole("button", { name: "Analisar arquivo" }).click();
  await expect(
    page.getByRole("heading", { name: "Prévia e mapeamento" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar mapeamento" }).click();
  await expect(
    page.getByRole("heading", { name: "Importação pronta para revisão" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Compromissos", exact: true }).click();
  await page.getByRole("button", { name: "Importar plano de ações" }).click();
  await page
    .getByLabel("Arquivo de compromissos")
    .setInputFiles("packages/test-fixtures/commitments-template.csv");
  await page.getByRole("button", { name: "Visualizar importação" }).click();
  await expect(
    page.getByRole("heading", { name: "1 compromissos válidos · 0 erros" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Confirmar importação" }).click();
  await expect(
    page.getByRole("button", {
      name: "Apresentar plano de manutenção",
      exact: true,
    }),
  ).toBeVisible();
});

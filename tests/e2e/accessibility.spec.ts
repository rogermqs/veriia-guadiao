import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { existsSync, writeFileSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
test("login and overview have no serious or critical accessibility violations", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/login");
  const login = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  await page
    .getByLabel("E-mail", { exact: true })
    .fill(process.env.AGM_BOOTSTRAP_ADMIN_EMAIL!);
  await page
    .getByLabel("Senha", { exact: true })
    .fill(process.env.AGM_BOOTSTRAP_ADMIN_PASSWORD!);
  await page.getByRole("button", { name: "Entrar no sistema" }).click();
  await expect(page.locator(".metric-value").first()).not.toHaveText("");
  const overview = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  const violations = [
    ...login.violations.map((v) => ({ ...v, page: "login" })),
    ...overview.violations.map((v) => ({ ...v, page: "overview" })),
  ];
  writeFileSync(
    "docs/contracts/accessibility.json",
    JSON.stringify({ violations }, null, 2),
  );
  expect(
    violations
      .filter((v) => ["serious", "critical"].includes(v.impact || ""))
      .map((v) => ({
        id: v.id,
        page: v.page,
        nodes: v.nodes.map((n) => n.target),
      })),
  ).toEqual([]);
});

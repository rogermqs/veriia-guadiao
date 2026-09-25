import { test, expect } from "@playwright/test";

test("theme persists from landing to login and follows the system until selected", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/index.html");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "Ativar modo claro" }).click();
  await page.goto("/login");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.getByRole("button", { name: "Ativar modo escuro" }).click();
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator(".login-brain img")).toBeVisible();
});

test("neural overview links to chat and keeps the compact header on mobile", async ({
  page,
}) => {
  const duplicateKeyErrors: string[] = [];
  page.on("console", (message) => {
    if (/same key|unique.*key/i.test(message.text()))
      duplicateKeyErrors.push(message.text());
  });
  await page.route("**/api/v1/**", (route) => {
    const url = route.request().url();
    const json = url.endsWith("/auth/me")
      ? {
          name: "Gestor de demonstração",
          workspaces: [
            { id: "demo", name: "Município demonstrativo", role: "admin" },
          ],
        }
      : url.endsWith("/dimensions")
        ? { departments: [], neighborhoods: [], subjects: [] }
        : url.includes("/analytics/summary")
          ? {
              result: {
                total_records: 0,
                pending_records: 0,
                closed_records: 0,
                average_response_days: null,
                unknown_status_records: 0,
                cancelled_records: 0,
                response_observation_count: 0,
              },
              data_as_of: "2026-09-24",
              id: "preview",
            }
          : url.includes("/analytics/")
            ? { result: { rows: [] }, id: "preview" }
            : url.endsWith("/capabilities")
              ? { provider_configured: true }
              : { items: [] };
    return route.fulfill({ json });
  });
  await page.goto("/agm");
  await expect(page.locator(".brain-overview")).toBeVisible();
  await expect(page.locator(".brain-area strong")).toContainText([
    "Saúde",
    "Financeiro",
    "Contratos",
    "Dados",
    "Conhecimento",
    "Decisões",
    "Compromissos",
  ]);
  await expect(page.locator(".brain-map img")).toHaveJSProperty(
    "naturalWidth",
    640,
  );
  expect(duplicateKeyErrors).toEqual([]);
  for (const area of ["Financeiro", "Contratos"]) {
    await page.locator(".brain-area").filter({ hasText: area }).click();
    await expect(page.getByLabel("Mensagem para o assistente")).toBeVisible();
    await page.getByRole("button", { name: "Visão geral", exact: true }).click();
    await expect(page.locator(".brain-area")).toHaveCount(7);
  }
  expect(duplicateKeyErrors).toEqual([]);
  await page
    .getByRole("button", { name: "Conversar com o Guardião", exact: true })
    .first()
    .click();
  await expect(
    page.getByRole("heading", { name: "Seu Segundo Cérebro", exact: true }),
  ).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.getByLabel("Mensagem para o assistente")).toBeInViewport();
  await expect(
    page.getByRole("button", { name: /Ativar modo/ }),
  ).toBeInViewport();
  expect(
    await page
      .locator(".second-brain-console")
      .evaluate((el) => el.getBoundingClientRect().height),
  ).toBeLessThanOrEqual(100);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("theme remains usable when storage is blocked", async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
  });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/login");
  await page.getByRole("button", { name: "Ativar modo escuro" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
});

test("chat lights the municipal brain across finance and contracts while consulting", async ({
  page,
}) => {
  await page.route("**/api/v1/**", (route) => {
    const request = route.request();
    const url = request.url();
    const path = new URL(url).pathname;
    if (path.endsWith("/auth/me")) {
      return route.fulfill({
        json: {
          name: "Gestor de demonstração",
          workspaces: [
            { id: "demo", name: "Município demonstrativo", role: "admin" },
          ],
        },
      });
    }
    if (path.endsWith("/dimensions")) {
      return route.fulfill({
        json: {
          departments: ["Saúde", "Finanças", "Contratos"],
          neighborhoods: [],
          subjects: [],
        },
      });
    }
    if (path.includes("/analytics/summary")) {
      return route.fulfill({
        json: {
          result: {
            total_records: 0,
            pending_records: 0,
            closed_records: 0,
            average_response_days: null,
            unknown_status_records: 0,
            cancelled_records: 0,
            response_observation_count: 0,
          },
          data_as_of: "2026-09-24",
          id: "preview",
        },
      });
    }
    if (path.includes("/analytics/")) {
      return route.fulfill({ json: { result: { rows: [] }, id: "preview" } });
    }
    if (path.endsWith("/capabilities")) {
      return route.fulfill({ json: { provider_configured: true } });
    }
    if (path.endsWith("/workspaces/demo/conversations")) {
      if (request.method() === "POST") {
        return new Promise(() => {});
      }
      return route.fulfill({ json: { items: [] } });
    }
    if (path.endsWith("/workspaces/demo/conversations/conv-visual/turns")) {
      return route.fulfill({ json: { turn_id: "turn-visual" } });
    }
    if (
      path.endsWith(
        "/workspaces/demo/conversations/conv-visual/turns/turn-visual/events",
      )
    ) {
      return route.fulfill({
        status: 200,
        headers: { "content-type": "text/event-stream" },
        body: "",
      });
    }
    return route.fulfill({ json: { items: [] } });
  });

  await page.goto("/agm");
  await page.getByRole("button", { name: /Assistente/i }).click();

  await expect(page.locator(".brain-domains span")).toContainText([
    "Saúde",
    "Financeiro",
    "Contratos",
    "Decisões",
  ]);
  await expect(page.locator(".brain-cycle span")).toContainText([
    "Escuta",
    "Contexto",
    "Contratos",
    "Decisão",
  ]);

  await page.getByRole("button", { name: /Analisar financeiro/i }).click();
  await page.getByLabel("Enviar mensagem").click();

  await expect(page.locator(".second-brain-console")).toHaveClass(
    /is-thinking/,
  );
  await expect(page.locator(".neural-progress")).toContainText(
    "financeiro, contratos",
  );
  await expect(page.locator(".brain-cycle span").nth(2)).toHaveClass(
    /is-hot/,
  );
});

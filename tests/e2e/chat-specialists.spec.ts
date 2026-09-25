import { test, expect } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    class Events extends EventTarget {
      constructor() {
        super();
        (window as any).chatEvents = this;
      }
      close() {}
    }
    (window as any).EventSource = Events;
  });
  await page.route("**/api/v1/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    const json = path.endsWith("/auth/me")
      ? {
          name: "Gestor",
          workspaces: [{ id: "demo", name: "Demonstração", role: "admin" }],
        }
      : path.endsWith("/dimensions")
        ? { departments: [], neighborhoods: [], subjects: [] }
        : path.endsWith("/capabilities")
          ? { provider_configured: true }
          : path.endsWith("/conversations") &&
              route.request().method() === "POST"
            ? { id: "c1" }
            : path.endsWith("/turns")
              ? { turn_id: "t1" }
              : path.endsWith("/conversations/c1")
                ? {
                    turns: [
                      {
                        id: "t1",
                        message: "Consulta",
                        status: "completed",
                        answer: {
                          text: "Resposta com evidência",
                          evidence_ids: ["s1"],
                        },
                      },
                    ],
                  }
                : path.endsWith("/sources/s1")
                  ? {
                      id: "s1",
                      title: "Contrato demonstrativo",
                      content: "Fonte de teste",
                    }
                  : path.includes("/analytics/")
                    ? {
                        result: {
                          rows: [],
                          total_records: 0,
                          pending_records: 0,
                          closed_records: 0,
                        },
                        id: "preview",
                      }
                    : { items: [] };
    await route.fulfill({ json });
  });
  await page.goto("/agm");
  await page.getByRole("button", { name: /Assistente/i }).click();
});

test("specialist guides the submitted question and demos remain editable", async ({
  page,
}) => {
  await page.getByRole("button", { name: "Contratos", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Contratos", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await page.getByText("Explorar conexões e roteiros").click();
  await expect(page.locator("details .connection-panel")).toContainText(
    "Fornecedores",
  );
  await page.getByRole("button", { name: "Usar roteiro de Contratos" }).click();
  const input = page.getByLabel("Mensagem para o assistente");
  await expect(input).toHaveValue(/contratos/i);
  await expect(page.locator(".neural-progress")).toHaveCount(0);
  await input.fill("Quais prazos exigem atenção?");
  const sent = page.waitForRequest(
    (r) => r.url().endsWith("/turns") && r.method() === "POST",
  );
  await page.getByLabel("Enviar mensagem").click();
  const body = (await sent).postDataJSON();
  expect(body.message).toContain("Foco de análise: Contratos");
  expect(body.message).toContain("Quais prazos exigem atenção?");
  expect(body.allow_write).toBe(false);
  await expect(
    page.getByRole("button", { name: "Financeiro", exact: true }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Nova conversa", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Gestão", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
});

test("failed requests preserve the question and release specialist controls", async ({
  page,
}) => {
  await page.route("**/conversations/c1/turns", (route) =>
    route.fulfill({ status: 503, json: { message: "Serviço indisponível" } }),
  );
  await page.getByRole("button", { name: "Financeiro", exact: true }).click();
  await page
    .getByLabel("Mensagem para o assistente")
    .fill("Como priorizar orçamento?");
  await page.getByLabel("Enviar mensagem").click();
  await expect(page.getByLabel("Mensagem para o assistente")).toHaveValue(
    "Como priorizar orçamento?",
  );
  await expect(
    page.getByRole("button", { name: "Contratos", exact: true }),
  ).toBeEnabled();
  await expect(page.locator(".neural-progress")).toHaveCount(0);
});

test("expanded brain restores focus and fits mobile in both themes", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["light", "dark"]) {
    await page.evaluate(
      (value) => (document.documentElement.dataset.theme = value),
      theme,
    );
    await page
      .getByRole("button", { name: "Expandir Segundo Cérebro" })
      .click();
    const dialog = page.getByRole("dialog", {
      name: "Segundo Cérebro expandido",
    });
    await expect(dialog).toBeVisible();
    expect(
      await dialog.evaluate(
        (el) => el.getBoundingClientRect().right <= innerWidth,
      ),
    ).toBe(true);
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(
      page.getByRole("button", { name: "Expandir Segundo Cérebro" }),
    ).toBeFocused();
  }
});

test("analysis follows server events and completed answers expose real evidence", async ({
  page,
}) => {
  await page
    .getByLabel("Mensagem para o assistente")
    .fill("Quais contratos vencem?");
  await page.getByLabel("Enviar mensagem").click();
  await expect(page.locator(".analysis-steps [aria-current=step]")).toHaveText(
    "Pergunta",
  );
  await page.evaluate(() =>
    (window as any).chatEvents.dispatchEvent(
      new MessageEvent("turn.status", {
        data: JSON.stringify({ message: "Consultando registros" }),
      }),
    ),
  );
  await expect(page.locator(".analysis-steps [aria-current=step]")).toHaveText(
    "Consulta",
  );
  await page.evaluate(() =>
    (window as any).chatEvents.dispatchEvent(
      new MessageEvent("turn.status", {
        data: JSON.stringify({
          message: "Preparando resposta com as fontes consultadas",
        }),
      }),
    ),
  );
  await expect(page.locator(".analysis-steps [aria-current=step]")).toHaveText(
    "Resposta",
  );
  await page.evaluate(() =>
    (window as any).chatEvents.dispatchEvent(new Event("answer.ready")),
  );
  await expect(
    page.getByText("Resposta com evidência", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".neural-progress")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Fonte 1" })).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Exportar briefing" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Nova conversa", exact: true })
    .click();
  await expect(page.getByLabel("Mensagem para o assistente")).toHaveValue("");
});

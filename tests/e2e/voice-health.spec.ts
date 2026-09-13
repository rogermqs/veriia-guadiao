import { test, expect } from "@playwright/test";
import { existsSync } from "node:fs";
if (existsSync(".env")) process.loadEnvFile(".env");
async function login(page: any) {
  await page.goto("/login");
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
}
test("health history, editable voice dictation, error and cleanup", async ({
  page,
}) => {
  await page.addInitScript(() => {
    class Recognition {
      lang = "";
      continuous = false;
      interimResults = false;
      onstart: any;
      onresult: any;
      onerror: any;
      onend: any;
      start() {
        (window as any).__recognition = this;
        this.onstart?.();
      }
      stop() {
        this.onend?.();
      }
      abort() {
        (window as any).__voiceStopped = true;
        this.onend?.();
      }
    }
    (window as any).SpeechRecognition = Recognition;
  });
  await login(page);
  await page.getByRole("button", { name: "Saúde", exact: true }).click();
  await page.getByLabel("Buscar cidadão").fill("Maria");
  await page.getByRole("button", { name: "Buscar", exact: true }).click();
  await expect(page.locator(".health-citizen")).toHaveCount(1);
  await page.locator(".health-citizen").click();
  await expect(page.getByRole("dialog")).toContainText(
    "Medicamento demonstrativo A",
  );
  await expect(page.getByRole("dialog")).toContainText("UBS Centro");
  await page.getByRole("button", { name: "Fechar painel" }).click();
  await page.getByRole("button", { name: "Assistente", exact: true }).click();
  await page.getByRole("button", { name: "Ditar pergunta" }).click();
  await expect(page.getByText("Ouvindo você…", { exact: true })).toBeVisible();
  await page.evaluate(() => {
    const r = (window as any).__recognition;
    r.onresult({
      results: [
        Object.assign([{ transcript: "Qual UBS atendeu Maria Oliveira?" }], {
          isFinal: true,
        }),
      ],
    });
    r.onend();
  });
  await expect(page.getByLabel("Mensagem para o assistente")).toHaveValue(
    "Qual UBS atendeu Maria Oliveira?",
  );
  await expect(page.locator(".user-message")).toHaveCount(0);
  await page.getByLabel("Mensagem para o assistente").fill("Pergunta revisada");
  await page.getByRole("button", { name: "Ditar pergunta" }).click();
  await page.evaluate(() => {
    (window as any).__recognition.onerror({ error: "not-allowed" });
  });
  await expect(page.getByText(/Microfone bloqueado/)).toBeVisible();
  await page.getByRole("button", { name: "Ditar pergunta" }).click();
  await page
    .getByRole("button", { name: "Nova conversa", exact: true })
    .click();
  expect(await page.evaluate(() => (window as any).__voiceStopped)).toBe(true);
});
test("unsupported microphone preserves text chat", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "SpeechRecognition", {
      value: undefined,
      configurable: true,
    });
    Object.defineProperty(window, "webkitSpeechRecognition", {
      value: undefined,
      configurable: true,
    });
  });
  await login(page);
  await page.getByRole("button", { name: "Assistente", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Ditar pergunta" }),
  ).toBeDisabled();
  await expect(
    page.getByText(/Este navegador não oferece ditado/),
  ).toBeVisible();
  await page
    .getByLabel("Mensagem para o assistente")
    .fill("Continuar por texto");
  await expect(
    page.getByRole("button", { name: "Enviar mensagem" }),
  ).toBeEnabled();
});

test("reads the newly completed answer, stops playback and never submits a dictated write automatically", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "speechSynthesis", {
      configurable: true,
      value: {
        getVoices: () => [],
        speak: (u: any) => {
          (window as any).__spoken = ((window as any).__spoken || "") + u.text;
          u.onstart?.();
        },
        cancel: () => {
          (window as any).__cancelled = true;
        },
      },
    });
  });
  await login(page);
  let sent: any = null;
  const answer = {
    text: "Maria foi atendida na UBS Jardim Norte. Esta é uma demonstração.",
    evidence_ids: [],
    queries: [],
    limitations: [],
  };
  await page.route(
    "**/api/v1/workspaces/demo/conversations**",
    async (route) => {
      const url = new URL(route.request().url());
      if (url.pathname.endsWith("/events"))
        return route.fulfill({
          contentType: "text/event-stream",
          body: "event: answer.ready\ndata: {}\n\n",
        });
      if (url.pathname.endsWith("/turns")) {
        sent = route.request().postDataJSON();
        return route.fulfill({ json: { turn_id: "voice-turn" } });
      }
      if (url.pathname.endsWith("/voice-conv"))
        return route.fulfill({
          json: {
            turns: [
              {
                id: "voice-turn",
                message: sent?.message,
                status: "completed",
                answer,
              },
            ],
          },
        });
      return route.fulfill({
        json:
          route.request().method() === "POST"
            ? { id: "voice-conv" }
            : { items: [] },
      });
    },
  );
  await page.getByRole("button", { name: "Assistente", exact: true }).click();
  await page.getByLabel("Ouvir respostas automaticamente").check();
  await page
    .getByLabel("Mensagem para o assistente")
    .fill("Qual UBS atendeu Maria?");
  await page.getByRole("button", { name: "Enviar mensagem" }).click();
  await expect(page.locator(".answer-text")).toContainText(
    "Maria foi atendida",
  );
  await expect
    .poll(() => page.evaluate(() => (window as any).__spoken || ""))
    .toContain("Maria foi atendida");
  expect(sent.allow_write).toBe(false);
  await expect(
    page.getByText("Falando com você…", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Parar áudio" }).click();
  expect(await page.evaluate(() => (window as any).__cancelled)).toBe(true);
  await expect(page.getByRole("button", { name: "Parar áudio" })).toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Ouvir resposta" }).click();
  await page
    .getByRole("button", { name: "Nova conversa", exact: true })
    .click();
  await expect(
    page.getByText("Pronto para pensar com você", { exact: true }),
  ).toBeVisible();
});

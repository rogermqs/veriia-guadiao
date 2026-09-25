import { test, expect } from "@playwright/test";

test("brain rotates on click, drag and keyboard and can be reset", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/index.html");
  const brain = page.getByRole("button", {
    name: "Girar o Segundo Cérebro",
    exact: true,
  });
  await expect(brain).toHaveClass(/is-interactive/);
  const canvas = brain.locator("canvas");
  const pixels = () =>
    canvas.evaluate((el: HTMLCanvasElement) => el.toDataURL());
  const initial = await pixels();
  await brain.click();
  expect(await pixels()).not.toBe(initial);
  await page
    .getByRole("button", { name: "Restaurar posição do cérebro" })
    .click();
  expect(await pixels()).toBe(initial);
  await brain.focus();
  await page.keyboard.press("ArrowRight");
  expect(await pixels()).not.toBe(initial);
  await page.keyboard.press("Home");
  expect(await pixels()).toBe(initial);
  const box = (await brain.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box.x + box.width / 2 + 80,
    box.y + box.height / 2 + 20,
    { steps: 8 },
  );
  await page.mouse.up();
  expect(await pixels()).not.toBe(initial);
  await page
    .getByRole("button", { name: "Restaurar posição do cérebro" })
    .click();
  await brain.focus();
  await page.keyboard.press("Enter");
  expect(await pixels()).not.toBe(initial);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await expect(brain).toBeVisible();
});

test("the connections manifesto is visible in the opening desktop viewport", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 768 });
  await page.goto("/index.html");
  const manifesto = page.getByText("TODAS AS CONEXÕES.", { exact: true });
  await expect(manifesto).toBeVisible();
  expect(
    await page
      .locator(".hero-eyebrow")
      .evaluate((element) => Math.floor(element.getBoundingClientRect().top)),
  ).toBeLessThanOrEqual(130);
  expect(
    await manifesto.evaluate((element) =>
      Math.ceil(element.getBoundingClientRect().bottom),
    ),
  ).toBeLessThanOrEqual(740);
  await expect(page.locator(".hero-bottom .ecosystem-product")).toBeInViewport();
  await expect(page.locator(".neural-hero-areas span")).toContainText([
    "Saúde",
    "Financeiro",
    "Contratos",
    "Decisões",
    "Conhecimento",
    "Compromissos",
  ]);
  expect(
    await page
      .locator(".hero-art.second-brain-hero")
      .evaluate((element) => Math.floor(element.getBoundingClientRect().height)),
  ).toBeGreaterThanOrEqual(548);
});

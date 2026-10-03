import { expect, test } from "./fixtures";

test("Professor Oak tour: first seed in the RNG, done along with the user", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Primeira seed no RNG" }).click();
  const tour = page.getByRole("dialog", { name: /Primeira seed no RNG, passo \d de 9/ });
  const count = tour.locator(".tour-count");
  const next = tour.getByRole("button", { name: "Próximo" });
  await expect(count).toHaveText("1/9");
  await expect(page.locator(".tour-ring")).toHaveCount(0);
  for (const [n, target] of [[2, "rng-game"], [3, "rng-option"], [4, "rng-steps"]] as const) {
    await next.click();
    await expect(count).toHaveText(`${n}/9`);
    await expect(page.locator(`[data-tour="${target}"]`)).toBeVisible();
    await expect(page.locator(".tour-ring")).toBeVisible();
  }
  // Step 5 waits for a seed: Next stays disabled until Use is clicked; then the tour moves on by itself.
  await next.click();
  await expect(count).toHaveText("5/9");
  await expect(next).toBeDisabled();
  await expect(tour).toContainText("Faça isso na página para seguir");
  await page.locator(".seed-list tr").nth(1).getByRole("button", { name: "Usar" }).click();
  await expect(count).toHaveText("6/9");
  await expect(next).toBeDisabled();
  const form = page.locator(".search-form").first();
  await form.locator("label", { hasText: "Espécie (opcional" }).getByRole("combobox").fill("1");
  await page.locator(".combo-list [role=option]", { hasText: "Bulbasaur" }).click();
  await form.locator("label", { hasText: "Do avanço" }).locator("input").fill("2000");
  await form.locator("label", { hasText: "Até o avanço" }).locator("input").fill("2000");
  await form.getByRole("button", { name: "Buscar" }).click();
  await page.locator(".res-table tbody tr").first().getByRole("button", { name: "Mirar" }).click();
  await expect(count).toHaveText("7/9");
  await expect(page.locator('[data-tour="rng-timer"]')).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tour).toBeHidden();
  await page.getByRole("button", { name: 'Continuar "Primeira seed no RNG" (7 de 9)' }).click();
  await expect(count).toHaveText("7/9");
  await next.click();
  await expect(count).toHaveText("8/9");
  await next.click();
  await expect(count).toHaveText("9/9");
  await tour.getByRole("button", { name: "Concluir" }).click();
  await expect(tour).toBeHidden();
  await expect(page.getByRole("button", { name: "Primeira seed no RNG" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Continuar/ })).toHaveCount(0);
});

test("Professor Oak tour: arrows navigate and leaving the page closes the tour", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Primeira seed no RNG" }).click();
  const count = page.locator(".tour-count");
  // The first arrow finishes the text being typed out; the second advances.
  await page.keyboard.press("ArrowRight");
  await page.keyboard.press("ArrowRight");
  await expect(count).toHaveText("2/9");
  await page.keyboard.press("ArrowLeft");
  await expect(count).toHaveText("1/9");
  await page.goto("/editor");
  await expect(page.locator(".tour")).toHaveCount(0);
});

test("Professor Oak tour: calibrate the timer, opening the Check seed tab", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Calibrar o timer" }).click();
  const tour = page.getByRole("dialog", { name: /Calibrar o timer, passo \d de 6/ });
  const count = tour.locator(".tour-count");
  const next = tour.getByRole("button", { name: "Próximo" });
  await next.click();
  await expect(next).toBeDisabled();
  await page.locator(".seed-list tr").nth(1).getByRole("button", { name: "Usar" }).click();
  await expect(count).toHaveText("3/6");
  await expect(page.getByRole("tab", { name: "Conferir seed" })).toHaveAttribute("aria-selected", "true");
  await next.click();
  await expect(page.locator('[data-tour="rng-check-timer"]')).toBeVisible();
  await next.click();
  await expect(page.locator('[data-tour="rng-check-form"]')).toBeVisible();
  await next.click();
  await tour.getByRole("button", { name: "Concluir" }).click();
  await expect(tour).toBeHidden();
});

test("Professor Oak tour: type a code, with the practice example", async ({ page }) => {
  await page.goto("/codes");
  await page.getByRole("button", { name: "Guia com o Professor Oak" }).click();
  const tour = page.getByRole("dialog", { name: /Digitar um código, passo \d de 7/ });
  const count = tour.locator(".tour-count");
  const next = tour.getByRole("button", { name: "Próximo" });
  await next.click();
  await expect(page.locator('[data-tour="codes-safety"]')).toBeVisible();
  await next.click();
  await expect(page.locator('[data-tour="codes-input"] textarea').first()).toHaveValue('["Treino", "Oak 123"]');
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Conferir", exact: true }).click();
  await expect(count).toHaveText("4/7");
  await expect(page.locator(".naming-box-pick")).toHaveCount(2);
  await next.click();
  await expect(page.locator('[data-tour="codes-typing"]')).toBeVisible();
  await next.click();
  await expect(page.locator('[data-tour="codes-after"]')).toBeVisible();
  await next.click();
  await tour.getByRole("button", { name: "Concluir" }).click();
  await expect(tour).toBeHidden();
});

test("Professor Oak tour: the example does not erase an already pasted code", async ({ page }) => {
  await page.goto("/codes");
  const names = page.locator('[data-tour="codes-input"] textarea').first();
  await names.fill('["FM.oZ.Bn"]');
  await page.getByRole("button", { name: "Guia com o Professor Oak" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Próximo" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Próximo" }).click();
  await expect(page.locator(".tour-count")).toHaveText("3/7");
  await expect(names).toHaveValue('["FM.oZ.Bn"]');
});

test("Professor Oak tour: create a Pokémon in the editor and take it to the game", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("button", { name: "Guia com o Professor Oak" }).click();
  const tour = page.getByRole("dialog", { name: /Criar um Pokémon e levar ao jogo, passo \d+ de 10/ });
  const count = tour.locator(".tour-count");
  const next = tour.getByRole("button", { name: "Próximo" });
  await next.click();
  await expect(page.getByRole("tab", { name: "Criar ou editar" })).toHaveAttribute("aria-selected", "true");
  for (const target of ["editor-species", "editor-nature", "editor-trainer"]) {
    await next.click();
    await expect(page.locator(`[data-tour="${target}"]`)).toBeVisible();
  }
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  // WebKit can lose this click while the step's smooth scroll still moves the box; step 6 waits, so a repeat click is harmless.
  await expect(async () => {
    await next.click();
    await expect(count).toHaveText("6/10", { timeout: 1000 });
  }).toPass();
  await expect(next).toBeDisabled();
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(count).toHaveText("7/10");
  await next.click();
  await expect(next).toBeDisabled();
  await page.locator("#editor-result").getByRole("button", { name: "Colocar no jogo" }).click();
  await expect(count).toHaveText("9/10");
  await expect(page.locator('[data-tour="editor-send-writer"]')).toBeVisible();
  await next.click();
  await tour.getByRole("button", { name: "Concluir" }).click();
  await expect(tour).toBeHidden();
});

test("Professor Oak tour: the written guide's link opens the interactive tour", async ({ page }) => {
  await page.goto("/guides/codes");
  await page.getByRole("link", { name: "guia com o Professor Oak" }).click();
  await expect(page).toHaveURL(/\/codes$/);
  await expect(page.getByRole("dialog", { name: /Digitar um código, passo 1 de 7/ })).toBeVisible();
});

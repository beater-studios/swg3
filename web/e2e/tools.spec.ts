import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { BRAND, expect, noHorizontalScroll, test } from "./fixtures";

const FILES = join(dirname(fileURLToPath(import.meta.url)), "files");
const flow = JSON.parse(readFileSync(join(FILES, "flow.json"), "utf8"));

test("RNG: seed, target, timer, and the adjustment corrects the timer", async ({ page, isMobile }) => {
  await page.goto("/rng");
  // Only the visible step tab: the others stay mounted (hidden) and have similar fields.
  const tab = page.locator(".view > .stack > .tab-panel:not([hidden])");
  await page.locator("label", { hasText: "Perto de (segundos)" }).locator("input").fill("35");
  await page.locator(".seed-list tr", { hasText: flow.target_seed }).getByRole("button", { name: "Usar" }).click();
  await expect(page.locator(".tab-panel:not([hidden]) .chosen")).toContainText(flow.target_seed);
  await page.getByRole("tab", { name: /Alvo/ }).click();
  const form = page.locator(".search-form").first();
  const speciesBox = form.locator("label", { hasText: "Espécie (opcional" }).getByRole("combobox");
  await speciesBox.fill("1");
  await page.locator(".combo-list [role=option]", { hasText: "Bulbasaur" }).click();
  await expect(speciesBox).toHaveValue("Bulbasaur (Pallet Town, nível 5)");
  await form.locator("label", { hasText: "Do avanço" }).locator("input").fill("2000");
  await form.locator("label", { hasText: "Até o avanço" }).locator("input").fill("2000");
  await form.getByRole("button", { name: "Buscar" }).click();
  await expect(page.locator(".results .search-ball").first()).not.toHaveClass(/shaking/);
  await page.locator(".res-table tbody tr").first().getByRole("button", { name: "Mirar" }).click();
  await expect(page.getByRole("tab", { name: /Timer/ })).toHaveAttribute("aria-selected", "true");
  await expect(tab.locator(".timer-phases li")).toHaveCount(3);
  await expect(tab.locator(".timer-phases li").first()).toContainText("35,004 s");
  await tab.getByRole("button", { name: "Começar" }).click();
  await expect(tab.locator(".timer-phase")).toContainText("1. Aperte A no PRESS START");
  await tab.getByRole("button", { name: "Parar" }).click();
  await page.getByRole("tab", { name: /Ajustar/ }).click();
  const adjustNature = tab.locator("label", { hasText: /^Nature/ }).locator("input");
  await adjustNature.fill(flow.nature);
  await adjustNature.press("Enter");
  const inputs = tab.locator(".stats-entry tbody tr").first().locator("input");
  await inputs.nth(0).fill("5");
  for (let i = 0; i < 6; i++) await inputs.nth(i + 1).fill(String(flow.stats[i]));
  await tab.getByRole("button", { name: "Descobrir" }).click();
  const row = tab.locator("tr", { hasText: flow.hit_seed }).filter({ has: page.locator("td", { hasText: /^-30$/ }) });
  await row.getByRole("button", { name: "Foi este" }).click();
  await expect(page.locator(".notice").filter({ hasText: "Timer corrigido" })).toContainText(`-${flow.dms} ms`);
  await expect(page.locator(".notice").filter({ hasText: "Timer corrigido" })).toContainText("+502 ms");
  // A 1 frame advance difference on the manual card: chance, the timer does not change, but it can still be corrected.
  await page.getByRole("tab", { name: /Ajustar/ }).click();
  await tab.locator("label", { hasText: "Avanço de frame que saiu" }).locator("input").fill(String(2000 + 1));
  await tab.getByRole("button", { name: "Corrigir o timer" }).click();
  const chance = page.locator(".notice").filter({ hasText: "Diferença pequena" });
  await expect(chance).toBeVisible();
  await chance.getByRole("button", { name: "Corrigir mesmo assim" }).click();
  await expect(page.locator(".notice").filter({ hasText: "Timer corrigido" })).toContainText("etapa 2 -17 ms");
  if (isMobile) await noHorizontalScroll(page);
});

test("RNG: wild search with Unown and stopping midway", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("tab", { name: /Alvo/ }).click();
  await page.locator(".searches .tab-panel:not([hidden]) .search-form").getByRole("button", { name: "Buscar" }).click();
  await expect(page.locator(".searches .tab-panel:not([hidden]) .notice-error")).toContainText("Escolha uma seed na etapa 1");
  await page.getByRole("tab", { name: /Seed/ }).click();
  await page.getByRole("button", { name: "Usar" }).first().click();
  await page.getByRole("tab", { name: /Alvo/ }).click();
  await page.getByRole("tab", { name: "Selvagem" }).click();
  const wild = page.locator(".searches .tab-panel:not([hidden]) .search-form");
  const mapBox = wild.locator("label", { hasText: "Mapa" }).locator("input");
  await mapBox.fill("liptoo");
  await mapBox.press("Enter");
  await wild.getByRole("button", { name: /^Letra C,/ }).click();
  await expect(wild.locator(".option-card.selected")).toContainText("Unown");
  await wild.locator("label", { hasText: "Até o avanço" }).locator("input").fill("5000");
  await wild.getByRole("button", { name: "Buscar" }).click();
  await expect(page.locator(".tab-panel:not([hidden]) .results .count")).toContainText("resultado");
  await expect(page.locator(".tab-panel:not([hidden]) .res-table tbody tr").first()).toContainText("Unown C");
});

test("Pokémon: open, edit, create and put in the game through Base64", async ({ page }) => {
  await page.goto("/editor");
  await page.locator(".dropzone input").setInputFiles([join(FILES, "bulba.ek3"), join(FILES, "pika.pk8"), join(FILES, "party.pk3")]);
  await expect(page.locator(".mon-card")).toHaveCount(2);
  await expect(page.locator(".mon-card").first()).toContainText("válido");
  await expect(page.locator(".notice", { hasText: "pika.pk8" })).toContainText("jogo de Switch");
  await expect(page.locator(".mon-card").nth(1)).toContainText("erro(s)");
  await page.locator(".mon-card").first().getByRole("button", { name: "Editar" }).click();
  await page.locator("label", { hasText: "Apelido" }).locator("input").fill("BULBI");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(page.locator("#editor-result .mon-head h2")).toHaveText("BULBI");
  await page.locator("#editor-result").getByRole("button", { name: "Colocar no jogo" }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await page.getByRole("button", { name: "Gerar os nomes" }).click();
  await expect(page.locator(".b64")).toHaveCount(14);
  await page.getByRole("button", { name: "Ver o plano" }).click();
  await expect(page.locator(".plan-step").first()).toContainText("Start wild battle");
  await page.getByRole("button", { name: "Gerar receita" }).click();
  await expect(page.locator(".recipe-steps li").first()).toBeVisible();
  await page.getByRole("button", { name: "Conferir e digitar" }).click();
  await expect(page).toHaveURL(/\/codes$/);
  await expect(page.locator(".code-mon .mon-head h2")).toHaveText("BULBI");
  await expect(page.locator(".naming-box-pick")).toHaveCount(14);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
});

test("Codes: the game keyboard guides typing and marks the box", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/codes");
  await page.locator("textarea").first().fill('["FM.oZ.Bn", "abc 12"]');
  await page.getByRole("button", { name: "Conferir" }).click();
  const panel = page.locator(".naming-panel");
  await expect(panel.locator(".naming-box-pick")).toHaveCount(2);
  await expect(panel.locator(".naming-box-pick").first()).toHaveAttribute("aria-pressed", "true");
  await expect(panel.locator(".naming-now")).toContainText("Letra 1 de 8");
  for (let i = 0; i < 8; i++) await panel.getByRole("button", { name: "Próxima letra" }).click();
  await expect(panel.locator(".naming-screen .naming-glyph")).toHaveCount(8);
  await expect(panel.locator(".naming-now")).toContainText("já levou o cursor ao OK");
  await panel.getByRole("button", { name: "Confirmar o nome" }).click();
  await expect(panel.locator(".naming-box-pick").first()).toContainText("digitada");
  await expect(panel.getByLabel("Box 1 digitada")).toBeChecked();
  await panel.getByRole("button", { name: "Ir para a Box 2" }).click();
  await expect(panel.locator(".naming-box-pick").nth(1)).toHaveAttribute("aria-pressed", "true");
  // Name shorter than 8 letters: at the end, Start goes to OK and then A.
  for (let i = 0; i < 6; i++) await panel.getByRole("button", { name: "Próxima letra" }).click();
  await expect(panel.locator(".naming-now")).toContainText("Start leva o cursor ao OK");
});

test("Codes: Switch filter and remembered progress", async ({ page }) => {
  await page.goto("/codes");
  await page.locator("textarea").first().fill('["FM.oZ.Bn", "Rx5XxlIk"]');
  await page.getByRole("button", { name: "Conferir" }).click();
  const panel = page.locator(".naming-panel");
  await expect(panel.locator(".naming-letters button")).toHaveText(["F", "M", ".", "o", "Z", ".", "B", "n"]);
  await expect(panel.locator(".naming-box-pick").nth(1)).toContainText("aviso");
  await panel.getByLabel("Box 1 digitada").check();
  await panel.getByRole("button", { name: "Ir para a Box 2" }).click();
  await expect(panel).toContainText("filtro de palavras");
  await page.reload();
  await page.locator("textarea").first().fill('["FM.oZ.Bn", "Rx5XxlIk"]');
  await page.getByRole("button", { name: "Conferir" }).click();
  await expect(page.locator(".codes-summary .count")).toHaveText("1 de 2 boxes digitadas");
});

test("English in the tools, with logic messages translated", async ({ page }) => {
  await page.goto("/editor");
  await page.locator(".lang-btn").click();
  await expect(page).toHaveURL(/\/en\/editor$/);
  await page.locator(".dropzone input").setInputFiles([join(FILES, "party.pk3")]);
  await expect(page.locator(".mon-card .issues")).toContainText("level 0");
  await page.goto("/en/rng");
  await expect(page.locator(".game-params")).toContainText("Only combinations measured by the community");
});

test("RNG: cascading game options, only with measured combinations", async ({ page }) => {
  await page.goto("/rng");
  const field = (name: string | RegExp) => page.locator(".game-params label", { hasText: name }).locator("select");
  const options = (name: string | RegExp) => field(name).locator("option").allTextContents();
  await field("SOUND").selectOption("mono");
  expect(await options("BUTTON MODE")).toEqual(["HELP"]);
  expect(await options(/^Botão que você aperta/)).toEqual(["A", "START"]);
  await field(/^Botão que você aperta/).selectOption("start");
  await field("SOUND").selectOption("stereo");
  // START was not measured with STEREO: falls back to A on its own.
  expect(await options(/^Botão que você aperta/)).toEqual(["A"]);
  await page.locator(".segments label", { hasText: "LeafGreen" }).click();
  expect(await options("BUTTON MODE")).toEqual(["HELP", "LR"]);
  await expect(page.locator(".seed-list tbody tr").first()).toBeVisible();
});

test("RNG: an unmeasured combination uses estimated times, and the lock returns to a measured one", async ({ page }) => {
  await page.goto("/rng");
  const field = (name: string | RegExp) => page.locator(".game-params label", { hasText: name }).locator("select");
  await page.getByLabel("Só combinações medidas pela comunidade").uncheck();
  await field("BUTTON MODE").selectOption("l=a");
  await field(/^Botão que você aperta/).selectOption("l");
  await expect(page.locator(".game-params .notice-warn")).toContainText("MONO + HELP + A como referência");
  await page.getByLabel("Só combinações medidas pela comunidade").check();
  await expect(page.locator(".game-params .notice-warn")).toHaveCount(0);
});

test("RNG: switching tabs keeps what was typed and the results", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Usar" }).first().click();
  await page.getByRole("tab", { name: /Alvo/ }).click();
  const form = page.locator(".searches .tab-panel:not([hidden]) .search-form");
  await form.locator("label", { hasText: "Do avanço" }).locator("input").fill("3000");
  await form.locator("label", { hasText: "Até o avanço" }).locator("input").fill("3050");
  await form.getByRole("button", { name: "Buscar" }).click();
  const rows = page.locator(".searches .tab-panel:not([hidden]) .res-table tbody tr");
  await expect(rows.first()).toBeVisible();
  const count = await rows.count();
  await page.getByRole("tab", { name: /Seed/ }).click();
  await page.locator("body").press("Space");
  await page.getByRole("tab", { name: /Alvo/ }).click();
  await expect(form.locator("label", { hasText: "Do avanço" }).locator("input")).toHaveValue("3000");
  await expect(rows).toHaveCount(count);
  await page.getByRole("tab", { name: /Timer/ }).click();
  await expect(page.getByRole("button", { name: "Começar" })).toBeVisible();
});

test("RNG: the browser keeps the game and timer settings; seed and target are cleared on reload", async ({ page }) => {
  await page.goto("/rng");
  await page.locator(".game-params label", { hasText: "TID" }).locator("input").fill("12345");
  await page.getByRole("tab", { name: /Timer/ }).click();
  const timerTab = page.locator(".view > .stack > .tab-panel:not([hidden])");
  await timerTab.getByText("Configurar o timer", { exact: true }).click();
  await timerTab.getByLabel("Ajuste da etapa 1 (ms)").fill("1680");
  await timerTab.getByLabel("Bipes por etapa").fill("3");
  await page.getByRole("tab", { name: /Seed/ }).click();
  await page.locator(".segments label", { hasText: "LeafGreen" }).click();
  await page.getByRole("button", { name: "Usar" }).first().click();
  await expect(page.locator(".tab-panel:not([hidden]) .chosen")).toContainText("Seed escolhida");
  await page.reload();
  await expect(page.locator(".game-params label", { hasText: "TID" }).locator("input")).toHaveValue("12345");
  await expect(page.locator(".segments label.on")).toContainText(["LeafGreen", "Switch"]);
  await expect(page.locator(".tab-panel:not([hidden]) .chosen")).toContainText("Nenhuma seed escolhida");
  const saved = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? "{}"), `${BRAND.slug}.rng`);
  expect(Object.keys(saved).sort()).toEqual(["game", "timer"]);
  expect(Object.keys(saved.game).sort()).toEqual(["console", "ot", "setting", "sid", "strict", "tid", "version"]);
  expect(saved.timer).toMatchObject({ cal1: 1680, beeps: 3 });
  await page.getByRole("tab", { name: /Timer/ }).click();
  const timerTab2 = page.locator(".view > .stack > .tab-panel:not([hidden])");
  await timerTab2.getByText("Configurar o timer", { exact: true }).click();
  await expect(timerTab2.getByLabel("Ajuste da etapa 1 (ms)")).toHaveValue("1680");
});

test("RNG: check seed without a target, with a one-beep timer and the Pokémon form", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Usar" }).first().click();
  await page.getByRole("button", { name: "Só conferir a seed" }).click();
  const panel = page.locator(".tab-panel:not([hidden])").filter({ hasText: "O Pokémon que você capturou" });
  await expect(panel).toContainText("aperte A no último bipe");
  await expect(panel.getByRole("button", { name: "Começar" })).toBeEnabled();
  const map = panel.locator("label", { hasText: "Mapa" }).first().locator("input");
  await expect(map).toHaveValue("");
  await panel.getByRole("button", { name: "Descobrir" }).click();
  await expect(page.locator(".notice-error")).toContainText("Escolha o mapa");
  await map.fill("route 6");
  await map.press("Enter");
  await panel.getByRole("button", { name: "Descobrir" }).click();
  await expect(page.locator(".notice-error")).toContainText("Escolha a espécie e a nature");
  await panel.locator("label", { hasText: "Espécie" }).locator("select").selectOption({ label: "Pidgey" });
  const nature = panel.locator("label", { hasText: "Nature" }).locator("input");
  await nature.fill("adamant");
  await nature.press("Enter");
  await panel.getByRole("button", { name: "Descobrir" }).click();
  await expect(page.locator(".notice-error")).toContainText("Preencha o nível e os 6 stats");
  await expect(panel.getByText("Subiu de nível batalhando")).toHaveCount(0);
  await panel.getByRole("button", { name: "Mais um nível" }).first().click();
  await expect(panel.getByLabel("Subiu de nível batalhando", { exact: false })).toBeChecked();
  await panel.getByLabel("Capturei um segundo Pokémon na mesma tentativa").check();
  const second = panel.locator(".group", { hasText: "Segundo Pokémon" });
  await expect(second.locator("label", { hasText: "Mapa" }).locator("input")).toHaveValue("Route 6");
  await panel.getByRole("button", { name: "Descobrir" }).click();
  await expect(page.locator(".notice-error")).toContainText("Preencha o nível e os 6 stats");
});

test("RNG: changing version, console or OPTION menu clears the chosen seed", async ({ page }) => {
  await page.goto("/rng");
  const chosen = page.locator(".tab-panel:not([hidden]) .chosen");
  const pick = async () => {
    await page.getByRole("button", { name: "Usar" }).first().click();
    await expect(chosen).toContainText("Seed escolhida");
  };
  await pick();
  await page.locator(".segments label", { hasText: "LeafGreen" }).click();
  await expect(chosen).toContainText("Nenhuma seed escolhida");
  await pick();
  await page.locator(".segments label", { hasText: "Switch 2" }).click();
  await expect(chosen).toContainText("Nenhuma seed escolhida");
  await pick();
  await page.locator(".game-params label", { hasText: "SOUND" }).locator("select").selectOption("stereo");
  await expect(chosen).toContainText("Nenhuma seed escolhida");
  await pick();
  await page.locator(".game-params label", { hasText: "TID" }).locator("input").fill("777");
  await expect(chosen).toContainText("Seed escolhida");
});

test("RNG: reset adjustments and restore the timer defaults, with confirmation", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("tab", { name: /Timer/ }).click();
  const tab = page.locator(".view > .stack > .tab-panel:not([hidden])");
  await tab.getByText("Configurar o timer", { exact: true }).click();
  await expect(tab.getByRole("button", { name: "Zerar ajustes das etapas" })).toBeDisabled();
  await expect(tab.getByRole("button", { name: "Restaurar o padrão" })).toBeDisabled();
  await expect(tab).toContainText("nada para zerar");
  const cal1 = tab.getByLabel("Ajuste da etapa 1 (ms)");
  const beeps = tab.getByLabel("Bipes por etapa");
  await cal1.fill("120");
  await beeps.fill("3");
  await tab.getByRole("button", { name: "Zerar ajustes das etapas" }).click();
  await tab.getByRole("button", { name: "Cancelar" }).click();
  await expect(cal1).toHaveValue("120");
  await tab.getByRole("button", { name: "Zerar ajustes das etapas" }).click();
  await tab.getByRole("button", { name: "Sim, zerar os ajustes" }).click();
  await expect(cal1).toHaveValue("0");
  await expect(beeps).toHaveValue("3");
  await expect(tab.getByText("Ajustes das etapas zerados.")).toBeVisible();
  await tab.getByRole("button", { name: "Restaurar o padrão" }).click();
  await tab.getByRole("button", { name: "Sim, restaurar o padrão" }).click();
  await expect(beeps).toHaveValue("5");
});

test("RNG: the seed search filters the list and there is no manual seed field", async ({ page }) => {
  await page.goto("/rng");
  await expect(page.locator(".game-params label", { hasText: "Seed inicial" })).toHaveCount(0);
  const find = page.locator("label", { hasText: "Ou procure a seed" }).locator("input");
  const seeds = page.locator(".tab-panel:not([hidden]) .seed-list tbody td.mono");
  await find.fill("11");
  await expect(seeds.first()).toBeVisible();
  for (const text of await seeds.allTextContents()) expect(text.startsWith("11")).toBe(true);
  await find.fill("11C7");
  await expect(seeds).toHaveText(["11C7"]);
  await find.fill("zz");
  await expect(page.locator(".tab-panel:not([hidden]) .notice-error")).toContainText("hexadecimais");
  await find.fill("");
  await expect(page.getByRole("button", { name: "Mais tarde" })).toBeVisible();
});

test("RNG: the space bar starts and stops the timer on the Check seed tab", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Usar" }).first().click();
  await page.getByRole("button", { name: "Só conferir a seed" }).click();
  const tab = page.locator(".view > .stack > .tab-panel:not([hidden])");
  await page.locator("body").click({ position: { x: 5, y: 5 } });
  await page.keyboard.press("Space");
  await expect(tab.getByRole("button", { name: "Parar" })).toBeVisible();
  await page.keyboard.press("Space");
  await expect(tab.getByRole("button", { name: "Começar" })).toBeVisible();
});

test("RNG: check seed records the CONTINUE and battle times after the beep", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Usar" }).first().click();
  // Step 1 adjustment almost equal to the seed time: the beep arrives in under 1 s in the test.
  await page.getByRole("tab", { name: /Timer/ }).click();
  const timerTab = page.locator(".view > .stack > .tab-panel:not([hidden])");
  await timerTab.getByText("Configurar o timer", { exact: true }).click();
  await timerTab.locator("label", { hasText: "Ajuste da etapa 1" }).locator("input").fill("-34000");
  await page.getByRole("tab", { name: "Conferir seed" }).click();
  const tab = page.locator(".view > .stack > .tab-panel:not([hidden])");
  await tab.getByRole("button", { name: "Começar" }).click();
  await expect(tab.getByRole("button", { name: "Entrei em CONTINUE" })).toBeVisible({ timeout: 10_000 });
  await tab.getByRole("button", { name: "Entrei em CONTINUE" }).click();
  await expect(tab.getByRole("button", { name: "A batalha começou" })).toBeVisible();
  await tab.getByRole("button", { name: "A batalha começou" }).click();
  await expect(tab.locator(".timer-phase")).toContainText("Tempos marcados");
  await expect(tab.locator("label", { hasText: "CONTINUE aos" }).locator("input")).not.toHaveValue("");
  await expect(tab.locator("label", { hasText: "Batalha aos" }).locator("input")).not.toHaveValue("");
  await expect(tab.getByRole("button", { name: "Começar de novo" })).toBeVisible();
});

test("RNG: timer settings are shared by the Timer and Check seed tabs", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Usar" }).first().click();
  await page.getByRole("button", { name: "Só conferir a seed" }).click();
  const check = page.locator(".tab-panel:not([hidden])").filter({ hasText: "O Pokémon que você capturou" });
  await check.getByText("Configurar o timer", { exact: true }).click();
  await expect(check.getByLabel("Ajuste da etapa 2 (ms)")).toHaveCount(0);
  await check.getByLabel("Ajuste da etapa 1 (ms)").fill("1600");
  await expect(check).toContainText("Com ajuste da etapa 1: +1.600 ms");
  await page.getByRole("tab", { name: /Timer/ }).click();
  const timer = page.locator(".view > .stack > .tab-panel:not([hidden])");
  await timer.getByText("Configurar o timer", { exact: true }).click();
  await expect(timer.getByLabel("Ajuste da etapa 1 (ms)")).toHaveValue("1600");
});

test("RNG: learned offset explained with an example in the seed list", async ({ page }) => {
  await page.addInitScript((key) => {
    localStorage.setItem(key, JSON.stringify({ "firered|mono/help/a|switch1": [{ index: 259, dseed: -2 }] }));
  }, `${BRAND.slug}.learned`);
  await page.goto("/rng");
  await page.locator("label", { hasText: "Perto de (segundos)" }).locator("input").fill("35");
  await page.locator(".seed-list tr", { hasText: "16A4" }).getByRole("button", { name: "Usar" }).click();
  const notice = page.locator(".notice", { hasText: "Seeds ajustadas ao seu console" });
  await expect(notice).toContainText("o seu console deu um número 2 menor que o da tabela da comunidade");
  await expect(page.locator(".seed-list tr", { hasText: "16A4" })).toContainText("conferida");
  await expect(page.locator(".seed-list tbody tr", { hasText: "conferida" })).toHaveCount(1);
  await expect(page.locator(".note", { hasText: "conferida: instante" })).toBeVisible();
});

test("RNG: species by search, by name or number, with the keyboard", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Usar" }).first().click();
  await page.getByRole("tab", { name: /Alvo/ }).click();
  const box = page.locator(".searches .tab-panel:not([hidden])").locator("label", { hasText: "Espécie (opcional" }).locator("input");
  await box.fill("pikach");
  await expect(page.locator(".combo-list [role=option]")).toHaveCount(1);
  await box.press("Enter");
  await expect(box).toHaveValue("Pikachu");
  // National Pokédex number, not the game's internal one (Treecko is 252 in the Pokédex).
  await box.fill("252");
  await expect(page.locator(".combo-list [role=option]").first()).toContainText("#252");
  await expect(page.locator(".combo-list [role=option]").first()).toContainText("Treecko");
  await box.press("Escape");
  await expect(box).toHaveValue("Pikachu");
  await box.fill("nenh");
  await box.press("Enter");
  await expect(box).toHaveValue("nenhuma");
});

test("Editor: move and item by search, with the species' learnable moves first", async ({ page }) => {
  await page.goto("/editor");
  await page.locator(".dropzone input").setInputFiles(join(FILES, "bulba.ek3"));
  await page.locator(".mon-card").first().getByRole("button", { name: "Editar" }).click();
  // Razor Leaf is learned at level 20: with Bulbasaur at 25, it goes in the learned group.
  await page.locator("label", { hasText: /^Nível$/ }).locator("input").fill("25");
  const move = page.locator("label", { hasText: "Move 4" }).locator("input");
  await move.fill("razor");
  const list = page.locator(".combo-list");
  await expect(list.locator(".combo-group").first()).toContainText("Aprende");
  await expect(list.locator("[role=option]").first()).toContainText("Razor Leaf");
  await move.press("Enter");
  await expect(move).toHaveValue("Razor Leaf");
  const item = page.locator("label", { hasText: "Item segurado" }).locator("input");
  await page.getByText("Item, origem e outros").click();
  await item.fill("leftov");
  await item.press("Enter");
  await expect(item).toHaveValue("Leftovers");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(page.locator("#editor-result")).toContainText("Razor Leaf");
  await expect(page.locator("#editor-result")).toContainText("Leftovers");
});

test("RNG: egg pickup compares the four methods and shows each egg's method", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Usar" }).first().click();
  await page.getByRole("tab", { name: /Alvo/ }).click();
  await page.getByRole("tab", { name: /Ovo: pegar/ }).click();
  const form = page.locator(".searches .tab-panel:not([hidden]) .search-form");
  await expect(form.locator("label", { hasText: "Método da coleta" }).locator("select")).toHaveValue("all");
  await form.locator("label", { hasText: "1ª parte do PID" }).locator("input").fill("1A2B");
  await form.locator("label", { hasText: "Do avanço de frame" }).locator("input").fill("5000");
  await form.locator("label", { hasText: "Até o avanço de frame" }).locator("input").fill("5001");
  await form.getByRole("button", { name: "Buscar" }).click();
  const table = page.locator(".searches .tab-panel:not([hidden]) .res-table");
  await expect(table.locator("thead")).toContainText("Método");
  await expect(table.locator("tbody tr")).toHaveCount(8);
  for (const name of ["Bred", "Split", "Alternate", "Mixed"]) await expect(table.locator("tbody")).toContainText(name);
});

test("RNG: prerequisites at the top of the tabs, with a button to the missing step", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("tab", { name: /Timer/ }).click();
  const tab = page.locator(".view > .stack > .tab-panel:not([hidden])");
  const prereq = tab.locator(".prereq");
  await expect(prereq).toContainText("Antes desta etapa, faltam 2 coisas");
  await prereq.getByRole("button", { name: "Ir para a etapa 1" }).click();
  await expect(page.getByRole("tab", { name: /Seed/ })).toHaveAttribute("aria-selected", "true");
  await page.getByRole("button", { name: "Usar" }).first().click();
  await page.getByRole("tab", { name: /Timer/ }).click();
  await expect(prereq).toContainText("Antes desta etapa, falta uma coisa");
  await expect(prereq).toContainText("Escolher o alvo na etapa 2");
  await page.getByRole("tab", { name: /Conferir/ }).click();
  await expect(page.locator(".view > .stack > .tab-panel:not([hidden]) .prereq")).toHaveCount(0);
});

test("RNG: tolerant target shows the chance per attempt and sorts the most likely first", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Usar" }).first().click();
  await page.getByRole("tab", { name: /Alvo/ }).click();
  const panel = page.locator(".searches .tab-panel:not([hidden])");
  await panel.locator(".search-form").getByRole("button", { name: "Buscar" }).click();
  const table = panel.locator(".res-table");
  // The search runs in a worker over the seed and its neighbors: on a busy machine (5 browsers at once) it is slower.
  await expect(table.locator("thead")).toContainText("Chance", { timeout: 30_000 });
  await expect(table.locator("tbody tr").first()).toContainText(/\d+ de 21/);
  await panel.getByLabel("Mais prováveis primeiro").check();
  const first = await table.locator("tbody tr").first().innerText();
  const n = Number(/(\d+) de 21/.exec(first)![1]);
  expect(n).toBeGreaterThanOrEqual(1);
});

test("RNG: a TID typed with a leading zero is accepted", async ({ page }) => {
  await page.goto("/rng");
  const tid = page.locator(".game-params label", { hasText: "TID" }).locator("input");
  await tid.fill("01234");
  await page.getByRole("button", { name: "Usar" }).first().click();
  await page.getByRole("tab", { name: /Alvo/ }).click();
  const panel = page.locator(".searches .tab-panel:not([hidden])");
  await panel.locator(".search-form").getByRole("button", { name: "Buscar" }).click();
  await expect(panel.locator(".notice-error")).toHaveCount(0);
  await expect(panel.locator(".res-table tbody tr").first()).toBeVisible({ timeout: 30_000 });
});

test("numeric fields drop letters and accept negatives where it makes sense", async ({ page }) => {
  await page.goto("/rng");
  const tid = page.locator(".game-params label", { hasText: "TID" }).locator("input");
  await tid.pressSequentially("12a3");
  await expect(tid).toHaveValue("123");
  await tid.fill("");
  await tid.pressSequentially("01234");
  await expect(tid).toHaveValue("1234");
  await tid.fill("");
  await tid.pressSequentially("99999");
  await expect(tid).toHaveValue("65535");
  await page.getByRole("tab", { name: /Timer/ }).click();
  const tab = page.locator(".view > .stack > .tab-panel:not([hidden])");
  await tab.getByText("Configurar o timer", { exact: true }).click();
  const cal1 = tab.getByLabel("Ajuste da etapa 1 (ms)");
  await cal1.fill("");
  await cal1.pressSequentially("-1680");
  await expect(cal1).toHaveValue("-1680");
  await cal1.blur();
  await expect(cal1).toHaveValue("-1680");
  const beeps = tab.getByLabel("Bipes por etapa");
  await beeps.fill("");
  await beeps.pressSequentially("-3");
  await expect(beeps).toHaveValue("3");
});

test("Editor: game PID for the typed IVs", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await page.getByText("PID do jogo", { exact: true }).click();
  await page.getByRole("button", { name: "Achar PIDs do jogo para estes IVs" }).click();
  const rows = page.locator(".editor tbody tr").filter({ has: page.getByRole("button", { name: "Usar este PID" }) });
  await expect(rows.first()).toBeVisible();
  const pid = (await rows.first().locator("td").first().innerText()).trim();
  await rows.first().getByRole("button", { name: "Usar este PID" }).click();
  await expect(page.locator("label", { hasText: "PID fixo" }).locator("input")).toHaveValue(pid);
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(page.locator("#editor-result")).toContainText(pid);
  await expect(page.locator("#editor-result")).toContainText("válido");
});

test("Editor: no party option in the form; party format download from the card", async ({ page }) => {
  await page.goto("/editor");
  await page.locator(".dropzone input").setInputFiles(join(FILES, "bulba.ek3"));
  const card = page.locator(".mon-card").first();
  const download = page.waitForEvent("download");
  await card.getByRole("button", { name: "Baixar no formato de party (.pk3, 100 bytes)" }).click();
  const file = await download;
  const { readFile } = await import("node:fs/promises");
  expect((await readFile((await file.path())!)).length).toBe(100);
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await expect(page.getByLabel("Formato de party (100 bytes)")).toHaveCount(0);
});

test("RNG: egg gender and Ability follow the species", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("button", { name: "Usar" }).first().click();
  await page.getByRole("tab", { name: /Alvo/ }).click();
  await page.getByRole("tab", { name: /Ovo: aparecer/ }).click();
  const form = page.locator(".searches .tab-panel:not([hidden]) .search-form");
  const genderBox = form.locator("fieldset.segmented", { hasText: "Gênero" });
  const gender = genderBox.locator("input").first();
  const ability = form.locator("label", { hasText: "Ability" }).locator("select");
  await expect(gender).toBeDisabled();
  await expect(ability).toBeDisabled();
  const species = form.locator("label", { hasText: "Espécie do ovo" }).locator("input");
  await species.fill("geodude");
  await species.press("Enter");
  await expect(gender).toBeEnabled();
  await expect(genderBox.locator("label")).toHaveText(["qualquer", "♂macho", "♀fêmea"]);
  await genderBox.getByText("fêmea").click();
  await expect(genderBox.locator("label.on")).toContainText("fêmea");
  await expect(ability.locator("option")).toHaveText(["qualquer", "Rock Head (1ª)", "Sturdy (2ª)"]);
  await species.fill("magnemite");
  await species.press("Enter");
  await expect(gender).toBeDisabled();
  await expect(genderBox).toContainText("sem gênero");
});

test("Editor: icon before the ball and the item, in the form and on the card", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await page.getByText("Item, origem e outros").click();
  const ball = page.locator("label", { hasText: "Bola" });
  await expect(ball.locator(".combo-icon .item-icon")).toBeVisible();
  await ball.locator("input").fill("master");
  await expect(page.locator(".combo-list [role=option]").first().locator(".item-icon")).toBeVisible();
  await ball.locator("input").press("Enter");
  await expect(ball.locator("input")).toHaveValue("Master Ball");
  const item = page.locator("label", { hasText: "Item segurado" }).locator("input");
  await item.fill("rare can");
  await item.press("Enter");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  const card = page.locator("#editor-result .mon-card");
  await expect(card.locator(".item-name", { hasText: "Master Ball" }).locator(".item-icon")).toBeVisible();
  await expect(card.locator(".item-name", { hasText: "Rare Candy" }).locator(".item-icon")).toBeVisible();
});

test("Editor: Pokérus and ribbons follow the origin game; Mew gets the event mark", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await page.getByText("Pokérus e marca de evento").click();
  await page.getByText("Ribbons", { exact: true }).click();
  const pokerus = page.locator("label", { hasText: "Pokérus" }).locator("select");
  await expect(pokerus).toBeDisabled();
  await expect(page.getByLabel(/Champion Ribbon/)).toBeVisible();
  await expect(page.getByLabel(/Effort Ribbon/)).toHaveCount(0);
  await expect(page.locator("label", { hasText: "Cool Ribbon" })).toHaveCount(0);

  await page.getByText("Item, origem e outros").click();
  await page.locator("label", { hasText: "Jogo de origem" }).locator("select").selectOption({ label: "Emerald" });
  await expect(pokerus).toBeEnabled();
  await pokerus.selectOption({ label: "ativo" });
  await page.locator("label", { hasText: "Cool Ribbon" }).locator("select").selectOption({ label: "Master" });
  await page.getByLabel(/Effort Ribbon/).check();

  const species = page.locator("label", { hasText: "Espécie" }).first().locator("input");
  await species.fill("151");
  await species.press("Enter");
  await expect(species).toHaveValue("Mew");
  await expect(page.getByLabel(/Marca de evento/)).toBeChecked();
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  const card = page.locator("#editor-result .mon-card");
  const ribbonsRow = card.locator(".ribbon-list");
  await expect(ribbonsRow).toContainText("Cool Master");
  await expect(ribbonsRow).toContainText("Effort");
  await expect(ribbonsRow.locator(".ribbon-icon")).toHaveCount(2);
  await expect(card.locator(".kv", { hasText: "Pokérus" })).toContainText("ativo");

  await page.locator("label", { hasText: "Jogo de origem" }).locator("select").selectOption({ label: "FireRed" });
  await expect(page.getByLabel(/Effort Ribbon/)).toBeChecked();
  await expect(page.locator("label", { hasText: "Effort Ribbon" })).toContainText("não sai nesse jogo");
});

test("Guides and texts: a mentioned item gets highlighting and an icon", async ({ page }) => {
  await page.goto("/guides/put-in-game");
  const item = page.locator(".item-name.game-text", { hasText: "Everstone" }).first();
  await expect(item).toBeVisible();
  await expect(item.locator(".item-icon")).toBeVisible();
});

test("Editor: encounter location follows the origin game; held item only lists holdable items", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await page.getByText("Item, origem e outros").click();
  const game = page.locator("label", { hasText: "Jogo de origem" }).locator("select");
  const location = page.locator("label", { hasText: "Local de encontro" }).locator("input");
  const options = page.locator(".combo-list [role=option]");
  await expect(location).toHaveValue("automático");
  // Bulbasaur in FireRed: first where it appears (gift in Pallet Town, level 5).
  await location.fill("");
  await expect(page.locator(".combo-list .combo-group").first()).toContainText("Onde a espécie aparece");
  await expect(options.nth(1)).toContainText("PALLET TOWN (5)");
  await location.fill("pallet");
  await location.press("Enter");
  await expect(location).toHaveValue("PALLET TOWN (5)");
  await location.fill("faraway");
  await expect(page.locator(".combo-none")).toBeVisible();
  await location.press("Escape");

  await game.selectOption({ label: "Emerald" });
  await expect(location).toHaveValue("LITTLEROOT TOWN");
  await location.fill("faraway");
  await expect(options.first()).toContainText("FARAWAY ISLAND");
  await location.press("Enter");
  await location.fill("pallet");
  await expect(page.locator(".combo-none")).toBeVisible();
  await location.press("Escape");

  await game.selectOption({ label: "Sapphire" });
  await expect(location).toHaveValue("LITTLEROOT TOWN");
  await game.selectOption({ label: "FireRed" });
  await expect(location).toHaveValue("PALLET TOWN (5)");

  const item = page.locator("label", { hasText: "Item segurado" }).locator("input");
  await item.fill("mach bike");
  await expect(page.locator(".combo-none")).toBeVisible();
  await item.fill("hm01");
  await expect(page.locator(".combo-none")).toBeVisible();
  await item.fill("tm01");
  await expect(options.first()).toContainText("TM01");
});

test("Editor: the automatic location comes from a real encounter; the validator flags a species outside the location", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  const species = page.locator("label", { hasText: "Espécie" }).first().locator("input");
  await species.fill("6");
  await species.press("Enter");
  await page.locator("label", { hasText: /^Nível$/ }).locator("input").fill("36");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  const result = page.locator("#editor-result");
  await expect(result.locator(".mon-section", { hasText: "Validação" })).toContainText("Encontro escolhido pelo site: PALLET TOWN, nível de encontro 5");
  await expect(result.locator(".mon-card")).toContainText("válido");

  await page.getByText("Item, origem e outros").click();
  const location = page.locator("label", { hasText: "Local de encontro" }).locator("input");
  await location.fill("mt moon");
  await location.press("Enter");
  // With a blank level the site would pick "hatched from an egg in Mt. Moon", which is legitimate; caught at 20 is not.
  await page.locator("label", { hasText: /^Nível de encontro/ }).locator("input").fill("20");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(result.locator(".mon-card")).toContainText("não aparece em MT MOON");
});

test("RNG: Static lists the version's static encounters first, with location and level", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("tab", { name: /Alvo/ }).click();
  const form = page.locator(".searches .tab-panel:not([hidden])");
  const species = form.locator("label", { hasText: "Espécie (opcional" }).getByRole("combobox");
  await species.fill("mewtwo");
  await expect(page.locator(".combo-list .combo-group").first()).toContainText("Fixos, presentes e eventos do FireRed");
  await expect(page.locator(".combo-list [role=option]").first()).toContainText("Mewtwo (Cerulean Cave, nível 70)");
  await species.press("Enter");
  await expect(form.locator(".note", { hasText: "Onde:" })).toContainText("Cerulean Cave, nível 70");
  await species.fill("scyther");
  await expect(page.locator(".combo-list [role=option]").first()).toContainText("Scyther (Celadon City, nível 25)");
});

test("Editor: the encounter location shows the level ranges where the species appears", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  const species = page.locator("label", { hasText: "Espécie" }).first().locator("input");
  await species.fill("pidgeot");
  await species.press("Enter");
  await page.getByText("Item, origem e outros").click();
  await page.locator("label", { hasText: "Local de encontro" }).locator("input").fill("route 1");
  await expect(page.locator(".combo-list [role=option]").first()).toContainText("ROUTE 1 (2-5)");
});

test("Editor: validation gathers problems, notes, TID/SID warnings and what the site picked", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  const species = page.locator("label", { hasText: "Espécie" }).first().locator("input");
  await species.fill("zigzagoon");
  await species.press("Enter");
  await page.locator("fieldset.segmented", { hasText: "Shiny" }).getByText("sim", { exact: true }).click();
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  const validation = page.locator("#editor-result .mon-section", { hasText: "Validação" });
  await expect(validation.locator(".issues li", { hasText: "TID: não informado" })).toContainText("aviso");
  await expect(validation.locator(".issues li", { hasText: "Shiny" })).toContainText("vale mesmo assim");
  await expect(validation.locator(".issues li", { hasText: "marcado como chocado" })).toContainText("nota");
  await expect(validation.locator(".issues li", { hasText: "PID sorteado" })).toContainText("escolha");
});

test("Editor: the site's choices persist when checking again; an arbitrary PID is flagged", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  const species = page.locator("label", { hasText: "Espécie" }).first().locator("input");
  await species.fill("zigzagoon");
  await species.press("Enter");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  const validation = page.locator("#editor-result .mon-validation");
  await expect(validation).toContainText("PID sorteado");
  await page.locator(".editor summary", { hasText: "Ribbons" }).click();
  await page.getByLabel(/Champion Ribbon/).check();
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(page.locator("#editor-result .mon-card")).toContainText("Champion");
  await expect(validation).toContainText("PID sorteado");
  await expect(validation).toContainText("ovo chocado em FOUR ISLAND");

  // Caught Pokémon (encounter level above 0) with an arbitrary PID: PID and IVs do not match.
  await page.getByRole("button", { name: "Começar do zero" }).click();
  await species.fill("pidgey");
  await species.press("Enter");
  await page.locator("label", { hasText: "PID fixo" }).locator("input").fill("12345678");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(validation.locator(".issues li", { hasText: "não bate com os IVs" })).toContainText("aviso");
});

test("Editor: egg moves in their own group; by default only the ones the species learns", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  const move = page.locator("label", { hasText: "Move 4" }).locator("input");
  const groups = page.locator(".combo-list .combo-group");
  await move.fill("");
  await expect(groups.first()).toContainText("Aprende no nível 5");
  await expect(groups.nth(1)).toContainText("De ovo");
  await move.fill("hyper beam");
  await expect(page.locator(".combo-none")).toBeVisible();
  await move.press("Escape");
  await page.getByLabel("Só moves que a espécie aprende").uncheck();
  await move.fill("hyper beam");
  await expect(groups.first()).toContainText("Outros");
  await move.press("Escape");

  await page.getByLabel("Só moves que a espécie aprende").check();
  await move.fill("petal dance");
  await move.press("Enter");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  const validation = page.locator("#editor-result .mon-validation");
  await expect(validation).toContainText("ovo chocado em FOUR ISLAND");
  await expect(validation.locator(".issues li", { hasText: "Moves:" })).toHaveCount(0);
});

test("Editor: changing the species after creating picks the encounter again", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  const species = page.locator("label", { hasText: "Espécie" }).first().locator("input");
  await species.fill("zigzagoon");
  await species.press("Enter");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  const validation = page.locator("#editor-result .mon-validation");
  await expect(validation).toContainText("ovo chocado");
  await species.fill("bulbasaur");
  await species.press("Enter");
  await page.getByText("Item, origem e outros").click();
  const location = page.locator("label", { hasText: "Local de encontro" }).locator("input");
  await location.fill("pallet");
  await location.press("Enter");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(page.locator("#editor-result .mon-section", { hasText: "Origem e outros" })).toContainText(/Nível de encontro\s*5/);
  await expect(validation).not.toContainText("ovo chocado");
});

test("Editor: validation explains the choices and has a tag legend", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  const species = page.locator("label", { hasText: "Espécie" }).first().locator("input");
  await species.fill("zigzagoon");
  await expect(page.locator(".combo-list li", { hasText: "Zigzagoon" }).locator(".mon-icon")).toBeVisible();
  await species.press("Enter");
  await expect(page.locator(".combo-icon .mon-icon").first()).toBeVisible();
  await page.getByText("Item, origem e outros").click();
  const location = page.locator("label", { hasText: "Local de encontro" }).locator("input");
  await location.fill("viridian city");
  await location.press("Enter");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  const validation = page.locator("#editor-result .mon-validation");
  await expect(validation).toContainText("Nível de encontro escolhido pelo site: 0, como ovo chocado em VIRIDIAN CITY, porque ZIGZAGOON não aparece no FireRed");
  await expect(validation.locator(".issues li", { hasText: "Nível de encontro:" })).toContainText("0, porque o Pokémon está marcado como chocado de ovo");
  const legend = validation.locator(".issue-legend");
  await expect(legend).toContainText("só explica algo do Pokémon");
  await expect(legend).toContainText("o site decidiu sozinho");
});

test("Editor: without automatic choice, what was filled in applies", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await page.locator("label", { hasText: /^Nível$/ }).locator("input").fill("6");
  await page.getByText("Item, origem e outros").click();
  const location = page.locator("label", { hasText: "Local de encontro" }).locator("input");
  await location.fill("pallet");
  await location.press("Enter");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  const card = page.locator("#editor-result .mon-card");
  await expect(card.locator(".mon-validation")).toContainText("Nível de encontro escolhido pelo site: 5");
  await page.getByRole("button", { name: "Começar do zero" }).click();
  await page.locator("label", { hasText: /^Nível$/ }).locator("input").fill("6");
  await page.getByLabel("Escolher local e nível de encontro que o jogo daria").uncheck();
  await expect(page.locator("label", { hasText: "Nível de encontro (vazio: o nível atual)" })).toBeVisible();
  await location.fill("pallet");
  await location.press("Enter");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(card.locator(".mon-validation")).not.toContainText("escolhido pelo site: 5");
  await expect(card.locator(".mon-validation .issues li", { hasText: "Nível de encontro:" })).toContainText("6 não bate com PALLET TOWN");
});

test("Region map: pick the encounter location in the editor", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await page.getByText("Item, origem e outros").click();
  await page.getByRole("button", { name: "Ver no mapa" }).click();
  const dialog = page.locator("dialog.townmap-dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".townmap-cell.marked[aria-label='PALLET TOWN']")).toHaveCount(1);
  await dialog.locator(".townmap-cell[aria-label='VIRIDIAN CITY']").click();
  await expect(dialog).toBeHidden();
  await expect(page.locator("label", { hasText: "Local de encontro" }).locator("input")).toHaveValue("VIRIDIAN CITY");
});

test("Region map: a Ruby, Sapphire or Emerald origin opens Hoenn; the arrows switch regions", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await page.getByText("Item, origem e outros").click();
  const game = page.locator("label", { hasText: "Jogo de origem" }).locator("select");
  const location = page.locator("label", { hasText: "Local de encontro" }).locator("input");
  await game.selectOption({ label: "Emerald" });
  await page.getByRole("button", { name: "Ver no mapa" }).click();
  const dialog = page.locator("dialog.townmap-dialog[open]");
  const regionName = dialog.locator(".townmap-region > span");
  await expect(regionName).toHaveText("Hoenn");
  // Hoenn has the same frame as FR/LG, but not the thumbnails (those are only for Kanto and the Sevii).
  await expect(dialog.locator(".townmap-switch")).toHaveCount(0);
  await expect(dialog.locator(".townmap-case")).toHaveCount(2);
  const busy = dialog.locator(".townmap-cell[aria-label*='FIERY PATH']").first();
  const names = (await busy.getAttribute("aria-label"))!.split(" / ");
  expect(names.length).toBeGreaterThanOrEqual(3);
  await busy.hover();
  await expect(dialog.locator(".townmap-label span")).toHaveText(names);
  await busy.click();
  await expect(dialog.getByRole("menuitem", { name: "FIERY PATH" })).toBeVisible();
  await dialog.locator(".townmap-region > span").click();
  await dialog.locator(".townmap-cell[aria-label='RUSTBORO CITY']").first().click();
  await expect(dialog).toBeHidden();
  await expect(location).toHaveValue("RUSTBORO CITY");

  await game.selectOption({ label: "Ruby" });
  await page.getByRole("button", { name: "Ver no mapa" }).click();
  await dialog.locator(".townmap-cell[aria-label*='ARTISAN CAVE']").click();
  await dialog.getByRole("menuitem", { name: "ARTISAN CAVE" }).click();
  await expect(game.locator("option:checked")).toHaveText("Emerald");
  await expect(location).toHaveValue("ARTISAN CAVE");

  await page.getByRole("button", { name: "Ver no mapa" }).click();
  await dialog.getByRole("button", { name: "Próxima região" }).click();
  await expect(regionName).toHaveText("Kanto");
  await expect(dialog.locator(".townmap-switch")).toBeVisible();
  await dialog.locator(".townmap-switch button[title='Sevii 4-5']").click();
  await expect(regionName).toHaveText("Sevii 4-5");
  await dialog.getByRole("button", { name: "Próxima região" }).click();
  await expect(regionName).toHaveText("Hoenn");
  await dialog.getByRole("button", { name: "Região anterior" }).click();
  await expect(regionName).toHaveText("Kanto");
  await dialog.locator(".townmap-cell[aria-label='PALLET TOWN']").click();
  await expect(game.locator("option:checked")).toHaveText("FireRed");
  await expect(location).toHaveValue(/^PALLET TOWN/);

  // Battle Frontier with Ruby: the game stays, and the validation warns (in R/S this number is the Battle Tower).
  await game.selectOption({ label: "Ruby" });
  await page.getByRole("button", { name: "Ver no mapa" }).click();
  await expect(dialog.locator(".townmap-region > span")).toHaveText("Hoenn");
  await dialog.locator(".townmap-cell[aria-label^='BATTLE FRONTIER']").first().click();
  const frontier = dialog.getByRole("menuitem", { name: "BATTLE FRONTIER" });
  if (await frontier.isVisible()) await frontier.click();
  await expect(game.locator("option:checked")).toHaveText("Ruby");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(page.locator("#editor-result .mon-validation")).toContainText("Battle Tower");
  await game.selectOption({ label: "FireRed" });

  await page.getByRole("button", { name: "Ver no mapa" }).click();
  await dialog.getByRole("button", { name: "Próxima região" }).click();
  await dialog.locator(".townmap-cell[aria-label='RUSTBORO CITY']").first().click();
  await expect(game.locator("option:checked")).toHaveText("Emerald");
});

test("Region map: in the RNG, a cell with several maps asks which one; region switching and keyboard", async ({ page }) => {
  await page.goto("/rng");
  await page.getByRole("tab", { name: /Alvo/ }).click();
  await page.getByRole("tab", { name: "Selvagem" }).click();
  const panel = page.locator(".searches .tab-panel:not([hidden])");
  await panel.getByRole("button", { name: "Ver no mapa" }).click();
  const dialog = page.locator("dialog.townmap-dialog[open]");
  await dialog.locator(".townmap-cell[aria-label$='MT MOON']").click();
  // The cell is Route 4 and Mt. Moon (as in the game, "ROUTE 4 / MT. MOON"): the options appear in the game menu,
  // focused on the first; down twice and Enter pick B1F.
  const menu = dialog.getByRole("menu", { name: "Escolha o local" });
  await expect(menu.getByRole("menuitem")).toHaveText(["Route 4", "Mt Moon 1F", "Mt Moon B1F", "Mt Moon B2F"]);
  await dialog.locator(".townmap-bar > span").first().click();
  await expect(menu).toHaveCount(0);
  await dialog.locator(".townmap-cell[aria-label$='MT MOON']").click();
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await menu.getByRole("menuitem").nth(3).hover();
  await expect(menu.getByRole("menuitem").nth(3)).toBeFocused();
  await menu.getByRole("menuitem").first().hover();
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Enter");
  await expect(dialog).toHaveCount(0);
  await expect(panel.locator("label", { hasText: "Mapa" }).first().locator("input")).toHaveValue("Mt Moon B1F");

  await panel.getByRole("button", { name: "Ver no mapa" }).click();
  await dialog.getByRole("button", { name: "Sevii 1-3" }).click();
  await expect(dialog.getByRole("button", { name: "Sevii 1-3" })).toHaveAttribute("aria-pressed", "true");
  await expect(dialog.locator(".townmap-cell[aria-label='ONE ISLAND']")).toHaveCount(1);
  await dialog.locator(".townmap-cell[aria-label$='MT EMBER']").first().click();
  const list = dialog.getByRole("menu", { name: "Escolha o local" });
  await expect(list).toBeVisible();
  const [menuBox, screenBox] = [await list.boundingBox(), await dialog.locator(".townmap-screen").boundingBox()];
  expect(menuBox!.y + menuBox!.height).toBeLessThanOrEqual(screenBox!.y + screenBox!.height + 1);
  expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
  await dialog.locator(".townmap-bar > span").first().click();
  await dialog.locator(".townmap-screen").focus();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
});

test("Region map: on touch, the first tap only shows the location; confirming picks it", async ({ page, isMobile }) => {
  test.skip(!isMobile, "touch projects only");
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await page.getByText("Item, origem e outros").click();
  await page.getByRole("button", { name: "Ver no mapa" }).click();
  const dialog = page.locator("dialog.townmap-dialog[open]");
  await page.waitForTimeout(500);
  await dialog.locator(".townmap-cell[aria-label='VIRIDIAN CITY']").tap();
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(".townmap-label")).toContainText("VIRIDIAN CITY");
  await dialog.getByRole("button", { name: "Escolher" }).tap();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator("label", { hasText: "Local de encontro" }).locator("input")).toHaveValue("VIRIDIAN CITY");
  await page.getByRole("button", { name: "Ver no mapa" }).click();
  await page.waitForTimeout(500);
  await dialog.locator(".townmap-cell[aria-label='PEWTER CITY']").tap();
  await dialog.locator(".townmap-cell[aria-label='PEWTER CITY']").tap();
  await expect(page.locator("label", { hasText: "Local de encontro" }).locator("input")).toHaveValue("PEWTER CITY");
});

test("Region map: the cursor alternates between its two frames, even with reduced motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/rng");
  await page.getByRole("tab", { name: /Alvo/ }).click();
  await page.getByRole("tab", { name: "Selvagem" }).click();
  await page.locator(".searches .tab-panel:not([hidden])").getByRole("button", { name: "Ver no mapa" }).click();
  const cursor = page.locator("dialog[open] .townmap-cursor");
  // Watch until both frames show up (on a loaded machine the first frame may take a while to change).
  const seen = new Set<string>();
  await expect.poll(async () => {
    seen.add(await cursor.evaluate((el) => getComputedStyle(el).backgroundPosition));
    return seen.size;
  }, { timeout: 5000, intervals: [100] }).toBe(2);
});

test("Region map: on mobile, zoom and drag move only the map", async ({ page, isMobile }) => {
  test.skip(!isMobile, "the zoom control only appears on mobile");
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await page.getByText("Item, origem e outros").click();
  await page.getByRole("button", { name: "Ver no mapa" }).click();
  const dialog = page.locator("dialog.townmap-dialog[open]");
  const view = dialog.locator(".townmap-view");
  await page.waitForTimeout(500);
  await expect(dialog.getByRole("button", { name: "Afastar" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Aproximar" }).tap();
  await expect(view).toHaveAttribute("style", /scale\(1\.5\)/);
  await dialog.getByRole("button", { name: "Aproximar" }).tap();
  await expect(view).toHaveAttribute("style", /scale\(2\)/);
  await expect(dialog.locator(".townmap-bar")).not.toHaveAttribute("style", /scale/);
  const before = await view.getAttribute("style");
  const box = (await view.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 60, box.y + box.height / 2 - 30, { steps: 5 });
  await page.mouse.up();
  await expect(view).not.toHaveAttribute("style", before!);
  await expect(dialog).toBeVisible();
  await dialog.getByRole("button", { name: "Mapa inteiro" }).tap();
  await expect(view).toHaveAttribute("style", /scale\(1\) translate\(0%/);
});

test("Editor: the card shows the summary screen like the game, with its three pages", async ({ page }) => {
  await page.goto("/editor");
  await page.locator(".dropzone input").setInputFiles([join(FILES, "bulba.ek3")]);
  const card = page.locator(".mon-card").first();
  const photo = page.waitForResponse((r) => r.url().endsWith("/mon/front/1.png") && r.ok());
  const palettes = page.waitForResponse((r) => r.url().endsWith("/mon/palettes.json") && r.ok());
  await card.getByRole("tab", { name: "Como no jogo" }).click();
  await Promise.all([photo, palettes]);
  const canvas = card.locator(".summary-screen canvas");
  await expect(canvas).toHaveAttribute("aria-label", /INFO/);
  await canvas.focus();
  await page.keyboard.press("ArrowRight");
  await expect(canvas).toHaveAttribute("aria-label", /SKILLS/);
  await card.getByText("MOVES", { exact: true }).click();
  await expect(canvas).toHaveAttribute("aria-label", /MOVES/);
  await card.getByRole("tab", { name: "Cartão" }).click();
  await expect(card.locator(".summary-screen")).toHaveCount(0);
});

test("Editor: creating from scratch uses the stored TID, SID and OT name; editing a file uses its own and stores nothing", async ({ page }) => {
  const field = (label: string | RegExp) => page.locator("label", { hasText: label }).first().locator("input");
  await page.goto("/rng");
  await field("TID (Trainer ID)").fill("12345");
  await field("SID (Secret ID)").fill("54321");
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await page.getByText("Item, origem e outros").click();
  await expect(field("TID (Trainer ID)")).toHaveValue("12345");
  await expect(field("SID (Secret ID)")).toHaveValue("54321");
  await field("Nome do OT").fill("ASH");
  await field("TID (Trainer ID)").fill("11111");
  await page.reload();
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  await page.getByText("Item, origem e outros").click();
  await expect(field("Nome do OT")).toHaveValue("ASH");
  await expect(field("TID (Trainer ID)")).toHaveValue("11111");
  await page.goto("/rng");
  await expect(field("TID (Trainer ID)")).toHaveValue("11111");

  await page.goto("/editor");
  await page.getByRole("tab", { name: "Abrir" }).click();
  await page.locator(".dropzone input").setInputFiles([join(FILES, "bulba.ek3")]);
  await page.locator(".mon-card").first().getByRole("button", { name: "Editar" }).click();
  await page.getByText("Item, origem e outros").click();
  const fileTid = await field("TID (Trainer ID)").inputValue();
  expect(fileTid).not.toBe("11111");
  await expect(field("Nome do OT")).not.toHaveValue("ASH");
  await field("Nome do OT").fill("GARY");
  await field("TID (Trainer ID)").fill("22222");
  await page.getByRole("button", { name: "Começar do zero" }).click();
  await expect(field("Nome do OT")).toHaveValue("ASH");
  await expect(field("TID (Trainer ID)")).toHaveValue("11111");
});

test("Editor: Unown only appears in the Tanoby chambers that give the letter", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  const species = page.locator("label", { hasText: "Espécie" }).first().locator("input");
  await species.fill("unown");
  await species.press("Enter");
  await page.locator("label", { hasText: "Nível" }).first().locator("input").fill("30");
  await page.locator("label", { hasText: "Letra do Unown" }).locator("select").selectOption("B");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByText("Item, origem e outros").click();
  const location = page.locator("label", { hasText: "Local de encontro" }).locator("input");
  await location.click();
  const list = page.locator(".combo-list");
  // B only comes from Rixy Chamber; Monean (A and ?) goes to the other locations, with the reason.
  await expect(list.locator("li", { hasText: "RIXY CHAMBER" })).toContainText("(25)");
  await expect(list.locator("li", { hasText: "MONEAN CHAMBER" })).toContainText("não dá a letra B");
  await location.press("Escape");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  const validation = page.locator("#editor-result .mon-validation");
  await expect(validation).toContainText("RIXY CHAMBER");
  await expect(validation).not.toContainText("do Unown não sai");
  await location.fill("monean");
  await location.press("Enter");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(validation).toContainText("letra B do Unown não sai em MONEAN CHAMBER: lá saem A, ?.");
});

test("Editor: egg moves without a common father; XD tutor in its own group", async ({ page }) => {
  await page.goto("/editor");
  await page.getByRole("tab", { name: "Criar ou editar" }).click();
  const move = (n: number) => page.locator("label", { hasText: `Move ${n}` }).locator("input");
  // Bulbasaur (the default) with Light Screen and Skull Bash: both are egg moves, and no father has both.
  await move(3).fill("light screen");
  await move(3).press("Enter");
  await move(4).fill("skull bash");
  await move(4).press("Enter");
  await page.locator("label", { hasText: "Nome do OT" }).locator("input").fill("RED");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  const validation = page.locator("#editor-result .mon-validation");
  await expect(validation).toContainText("ovo chocado em FOUR ISLAND");
  await expect(validation.locator(".issues li", { hasText: "Moves:" })).toContainText("não saem juntos do mesmo ovo");
  // With Safeguard instead of Skull Bash there is a father (Chikorita learns both): no warning.
  await move(4).fill("safeguard");
  await move(4).press("Enter");
  await page.getByRole("button", { name: "Criar e conferir" }).click();
  await expect(validation.locator(".issues li", { hasText: "Moves:" })).toHaveCount(0);

  const species = page.locator("label", { hasText: "Espécie" }).first().locator("input");
  await species.fill("butterfree");
  await species.press("Enter");
  await move(4).fill("nightmare");
  await expect(page.locator(".combo-list .combo-group").first()).toContainText("Tutor do XD");
  await move(4).press("Escape");
});

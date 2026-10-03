// Site version history, newest first. The first entry must match the version in web/package.json and pyproject.toml
// (a test checks this).

export interface ChangelogEntry {
  version: string;
  /** YYYY-MM-DD. */
  date: string;
  highlights: { pt: string[]; en: string[] };
}

export const CHANGELOG: ChangelogEntry[] = [
  {
    version: "0.1.0",
    date: "2026-10-02",
    highlights: {
      pt: [
        "RNG do FireRed e do LeafGreen no Switch: Pokémon fixos, selvagens (com os Unown de Tanoby) e ovos, com timer, conferência da seed pelos Pokémon capturados e ajuste do timer a cada tentativa.",
        "Editor de Pokémon: abra arquivos .pk3, crie ou edite (espécie, nível, nature, IVs, EVs, golpes, treinador e shiny) e veja na validação o que o jogo aceitaria.",
        "Vista \"Como no jogo\": a tela de resumo do FR/LG com a foto do Pokémon, inclusive shiny, com a letra do Unown, as manchas do Spinda e a forma do Deoxys do jogo de origem.",
        "Mapa da região para escolher o local de encontro: Kanto, as ilhas Sevii e Hoenn, com zoom no celular.",
        "Códigos da comunidade: confira os nomes de box dos códigos de ACE e digite seguindo o teclado do jogo na tela, que mostra o caminho do cursor letra por letra.",
        "Guias para chegar à ACE no Switch, com as telas do jogo, e avisos para proteger o seu save.",
        "TID, SID e nome do OT ficam salvos no navegador e valem no RNG e no editor.",
        "Temas de cada jogo, português e inglês, e um Mew que aparece de vez em quando e não quer ser pego.",
      ],
      en: [
        "FireRed and LeafGreen RNG on Switch: static, wild (including the Tanoby Unown) and egg Pokémon, with a timer, seed checking from caught Pokémon and timer tuning after each attempt.",
        "Pokémon editor: open .pk3 files, create or edit (species, level, nature, IVs, EVs, moves, trainer and shiny) and see in the validation what the game would accept.",
        "\"As in the game\" view: the FR/LG summary screen with the Pokémon picture, shiny included, with the Unown letter, Spinda's spots and the Deoxys form of the origin game.",
        "Region map to pick the met location: Kanto, the Sevii Islands and Hoenn, with zoom on phones.",
        "Community codes: check the box names of ACE codes and type them following the in-game keyboard on screen, which shows the cursor path letter by letter.",
        "Guides to reach ACE on Switch, with the game screens, and warnings to protect your save.",
        "TID, SID and OT name are saved in the browser and shared by the RNG and the editor.",
        "A theme for each game, Portuguese and English, and a Mew that shows up now and then and doesn't want to be caught.",
      ],
    },
  },
];

export const LATEST_VERSION = CHANGELOG[0].version;

export function isVersionNewer(a: string, b: string): boolean {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const x = pa[i] || 0, y = pb[i] || 0;
    if (x !== y) return x > y;
  }
  return false;
}

export function changelogDate(date: string, lang: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Intl.DateTimeFormat(lang === "en" ? "en-US" : "pt-BR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(y, m - 1, d)));
}

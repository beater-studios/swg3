// Tool shells: title and intro are prerendered; the body loads on demand as its own JS chunk.

import { lazy } from "react";
import { t } from "../i18n";
import { ClientOnly, Page } from "../ui";

const loaders = {
  "/rng": () => import("./rng/RngPage").then((m) => ({ default: m.RngTool })),
  "/editor": () => import("./pokemon/PokemonPage").then((m) => ({ default: m.EditorTool })),
  "/codes": () => import("./codes/CodesPage").then((m) => ({ default: m.CodesTool })),
};

export function preloadTool(path: string) {
  loaders[path as keyof typeof loaders]?.().catch(() => undefined);
}

const RngTool = lazy(loaders["/rng"]);
const EditorTool = lazy(loaders["/editor"]);
const CodesTool = lazy(loaders["/codes"]);

export function RngPage() {
  return (
    <Page title="RNG" lead={t("Escolha a seed, ache o Pokémon que você quer, cronometre e ajuste. Tudo aqui, sem precisar de outro programa.")}>
      <ClientOnly><RngTool /></ClientOnly>
    </Page>
  );
}

export function PokemonPage() {
  return (
    <Page title="Editor" heading={t("Editor de Pokémon")} lead={t("Abra um arquivo, crie ou ajuste um Pokémon e coloque no seu jogo.")}>
      <ClientOnly><EditorTool /></ClientOnly>
    </Page>
  );
}

export function CodesPage() {
  return (
    <Page title={t("Códigos")} heading={t("Códigos da comunidade")}
      lead={t("Cole aqui os nomes de box de um código. O site confere cada letra, avisa o que o Switch deve recusar e mostra, caixa por caixa, qual tecla apertar.")}>
      <ClientOnly><CodesTool /></ClientOnly>
    </Page>
  );
}

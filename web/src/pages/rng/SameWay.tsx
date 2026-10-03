// Reminder to always start the timer the same way.

import { t } from "../../i18n";
import { tx } from "../../i18n/rich";
import { Key, Notice } from "../../ui";

export function SameWay() {
  return (
    <Notice tone="tip" title={t("Comece o timer sempre do mesmo jeito")}>
      <p>{tx("Recomendado: clicar em Começar junto com o último {a} antes de o jogo carregar (o que confirma o perfil em \"Quem vai jogar?\", ou o {a} no ícone). É um clique seu, então varia menos do que reagir a algo na tela. Pode ser outro momento, desde que seja sempre igual: a aba Conferir seed mede a diferença do seu jeito, e o ajuste do timer compensa. Mudou o jeito? Em \"Configurar o timer\", use \"Zerar ajustes das etapas\" e confira a seed de novo.", { a: <Key>A</Key> })}</p>
    </Notice>
  );
}

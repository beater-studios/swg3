// Step 1: pick the initial seed from the Switch table (when to press the button on the title screen).

import { useEffect, useMemo, useState } from "react";
import { t } from "../../i18n";
import { Actions, Button, EmptyState, Field, Fields, Hint, Note, Notice, NumberInput, Panel, Table, Tag } from "../../ui";
import { seconds } from "../../components/format";
import { useRng } from "./store";
import * as learned from "./learned";
import { tx } from "../../i18n/rich";

const PAGE = 30;

export function SeedStep() {
  const { game, chosen, choose, setStep } = useRng();
  // `chosen` is a dependency so the table reflects a hit stored in the Adjust step.
  const entries = useMemo(() => (game.setting ? learned.table(game.version, game.setting, game.console) : []),
    [game.version, game.setting, game.console, chosen]);
  const adjusted = learned.isMeasured(game.version, game.setting) ? learned.points(game.version, game.setting, game.console) : [];
  const shiftValue = learned.shift(adjusted);
  const [near, setNear] = useState("35");
  const [find, setFind] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [center, setCenter] = useState<number | null>(null);
  useEffect(() => setCenter(null), [entries]);

  const isChosen = (e: { index: number }) =>
    chosen?.index === e.index && chosen.setting === game.setting && chosen.console === game.console && chosen.game === game.version;
  const nearIndex = (text: string) => Math.max(0, entries.findIndex((e) => e.ms >= Number(text) * 1000));

  const query = find.trim().toUpperCase().replace(/^0X/, "");
  const searching = /^[0-9A-F]{1,4}$/.test(query);
  const chosenIndex = entries.findIndex(isChosen);
  const base = center ?? (chosenIndex !== -1 ? chosenIndex : nearIndex(near));
  const start = Math.max(0, Math.min(base - 10, entries.length - PAGE));
  const rows = searching ? entries.filter((e) => e.seed.startsWith(query)).slice(0, 100) : entries.slice(start, start + PAGE);
  const page = (delta: number) => { setFind(""); setCenter(Math.max(0, Math.min(entries.length - 1, base + delta))); };

  return (
    <Panel tour="rng-seed-list">
      <Hint>{tx("A seed depende de quanto tempo passa até você apertar o botão na tela de título (a do logo do jogo com PRESS START). Escolha uma seed da lista: o timer avisa a hora certa. As opções de som e de botões precisam ser as mesmas do seu jogo.")}</Hint>
      <Fields>
        <Field label={t("Perto de (segundos)")}><NumberInput decimal min={0} value={near} onChange={(e) => { setNear(e.target.value); setCenter(nearIndex(e.target.value)); }} /></Field>
        <Field label={t("Ou procure a seed (hex)")}><input className="mono" maxLength={4} placeholder={t("ex.: 11C7")} value={find} onChange={(e) => setFind(e.target.value)} /></Field>
      </Fields>
      <p className="chosen">
        {chosen ? (
          <>
            {t("Seed escolhida: ")}<b className="mono">{chosen.seed}</b>{t(", apertando aos {time}. ", { time: seconds(chosen.ms) })}
            <Button size="sm" onClick={() => setStep("target")}>{t("Próximo: escolher o alvo")}</Button>
            <Button size="sm" onClick={() => setStep("check")}>{t("Só conferir a seed")}</Button>
          </>
        ) : t("Nenhuma seed escolhida ainda.")}
      </p>
      {find.trim() && !searching ? <Notice tone="error">{t("Use só dígitos hexadecimais (0 a 9 e A a F), até 4.")}</Notice>
        : searching && !rows.length ? <EmptyState>{t("Nenhuma seed começa com {query} com essas opções do jogo.", { query })}</EmptyState> : (
        <Table wrapClassName="seed-list">
            <thead><tr><th>seed</th><th>{t("apertar aos")}</th><th></th></tr></thead>
            <tbody>
              {rows.map((entry) => (
                <tr key={`${entry.index}`} className={isChosen(entry) ? "row-chosen" : undefined}>
                  <td className="mono">{entry.seed}{entry.source === "yours" && (
                    <> <Tag>{t("conferida")}</Tag></>
                  )}</td>
                  <td>{seconds(entry.ms)}</td>
                  <td>{isChosen(entry) ? <Tag>{t("escolhida")}</Tag> : (
                    <Button size="sm"
                      onClick={() => choose({ index: entry.index, seed: entry.seed, ms: entry.ms, game: game.version, setting: game.setting, console: game.console })}>{t("Usar")}</Button>
                  )}</td>
                </tr>
              ))}
            </tbody>
        </Table>
      )}
      {searching ? (
        rows.length > 0 && <Note>{t("{n} tempo(s) com seeds que começam com {query}. Apague a busca para voltar à lista inteira.", { n: rows.length, query })}</Note>
      ) : (
        <Actions>
          <Button size="sm" onClick={() => page(-PAGE)}>{t("Mais cedo")}</Button>
          <Button size="sm" onClick={() => page(PAGE)}>{t("Mais tarde")}</Button>
        </Actions>
      )}
      {entries.some((e) => e.source === "yours") && (
        <Note>{t("conferida: instante em que uma conferência sua (aba Conferir seed, com dois Pokémon ou duas conferências que concordam) mostrou a seed real; o valor da lista é o que saiu ali.")}</Note>
      )}
      {adjusted.length > 0 && (
        <Notice title={t("Seeds ajustadas ao seu console")}>
          <p>{shiftValue === 0
            ? t("Nas conferências que você fez ({n}), a seed saiu na maioria das vezes com o valor exato da tabela da comunidade, então a lista segue igual a ela.", { n: adjusted.length })
            : t("Cada seed é um número. Nas suas conferências ({n}), apertando no instante certo, o seu console deu um número {amount} {dir} que o da tabela da comunidade. Por isso a lista já mostra os números corrigidos: são os que devem sair no seu console.", {
              amount: Math.abs(shiftValue), dir: shiftValue < 0 ? t("menor") : t("maior"), n: adjusted.length })}</p>
          <p>{tx("Esquecer o deslocamento aprendido apaga só isso, desta combinação do menu OPTION e deste console: a lista volta aos valores da tabela da comunidade. Os ajustes do timer continuam.")}</p>
          <Actions>
            {confirmReset ? (
              <>
                <Button size="sm" variant="primary" onClick={() => {
                  learned.clear(game.version, game.setting, game.console);
                  setConfirmReset(false);
                  if (chosen) choose(learned.refreshed(chosen));
                }}>{t("Sim, esquecer")}</Button>
                <Button size="sm" onClick={() => setConfirmReset(false)}>{t("Cancelar")}</Button>
              </>
            ) : <Button size="sm" onClick={() => setConfirmReset(true)}>{t("Esquecer o deslocamento aprendido")}</Button>}
          </Actions>
        </Notice>
      )}
      <Note>{t("Tempos da planilha pública da comunidade usada pelo ten-lines. O ponto de partida do timer ainda não está confirmado para esta tabela: comece sempre do mesmo jeito, e a aba Conferir seed mede e corrige a diferença.")}</Note>
    </Panel>
  );
}

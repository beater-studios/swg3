// Codes page: checks a community code's box names and guides typing them.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { t } from "../../i18n";
import { Actions, Button, Check, Field, InGame, IssueList, Key, Note, Notice, Panel, PanelForm, Stack, Steps, Tag } from "../../ui";
import { MonCard } from "../../components/MonCard";
import { PcBoxTitle, TypingGuide } from "../../components/NamingScreen";
import { load, save } from "../../app/prefs";
import { storageKey } from "../../brand";
import * as svc from "../../lib/services/pokemon";
import * as rng from "../../lib/services/rng";
import { useCodes } from "./store";
import { TourStart } from "../../components/TourStart";

const PROGRESS_KEY = storageKey("codes");

function useProgress(id: string) {
  const [done, setDone] = useState<Set<number>>(() => new Set(load<Record<string, number[]>>(PROGRESS_KEY, {})[id] ?? []));
  useEffect(() => setDone(new Set(load<Record<string, number[]>>(PROGRESS_KEY, {})[id] ?? [])), [id]);
  const update = (next: Set<number>) => {
    setDone(next);
    const all = load<Record<string, number[]>>(PROGRESS_KEY, {});
    all[id] = [...next];
    const keys = Object.keys(all);
    if (keys.length > 20) delete all[keys[0]];
    save(PROGRESS_KEY, all);
  };
  return [done, update] as const;
}

function TypingPanel({ result, done, toggle }: { result: svc.BoxNamesResult; done: Set<number>; toggle: (n: number, on: boolean) => void }) {
  const boxes = result.boxes;
  const firstPending = boxes.find((b) => b.steps && !done.has(b.number)) ?? boxes[0];
  const [selected, setSelected] = useState(firstPending?.number ?? 0);
  useEffect(() => setSelected(firstPending?.number ?? 0), [result]);   // eslint-disable-line react-hooks/exhaustive-deps
  const box = boxes.find((b) => b.number === selected);
  if (!box) return null;
  const following = boxes.find((b) => b.number > box.number && b.steps && !done.has(b.number));
  const level = (b: svc.BoxNamesResult["boxes"][number]) =>
    b.issues.some((i) => i.level === "error") ? "error" : b.issues.length ? "warning" : null;
  return (
    <Panel className="naming-panel" tour="codes-typing">
      <h2>{t("Digitar no jogo")}</h2>
      <p>{t("No PC, em ")}<InGame>MOVE POKéMON</InGame>{t(", leve o cursor até o nome da box no alto, aperte ")}<Key>A</Key>{t(" e escolha ")}<InGame>NAME</InGame>
        {t(". A tela abaixo é a do jogo: clique em Próxima letra para ver o cursor ir até a tecla e faça o mesmo no jogo.")}</p>
      <div className="naming-boxes" aria-label={t("Boxes do código")}>
        {boxes.map((b) => (
          <button key={b.number} type="button" className={`naming-box-pick${b.number === box.number ? " selected" : ""}${level(b) === "error" ? " has-error" : ""}`}
            aria-pressed={b.number === box.number} onClick={() => setSelected(b.number)}>
            <PcBoxTitle number={b.number} name={b.name} />
            <span className="naming-box-label">Box {b.number}
              {done.has(b.number) ? <Tag tone="ok">{t("digitada")}</Tag> : level(b) === "error" ? <Tag tone="bad">{t("corrigir")}</Tag>
                : level(b) === "warning" ? <Tag tone="warn">{t("aviso")}</Tag> : null}</span>
          </button>
        ))}
      </div>
      {box.issues.length > 0 && <IssueList issues={box.issues} />}
      {box.steps && <TypingGuide key={box.number} box={box.number} name={box.name} steps={box.steps} onDone={() => toggle(box.number, true)} />}
      <Actions>
        {box.steps && <Check label={t("Box {n} digitada", { n: box.number })} checked={done.has(box.number)} onChange={(e) => toggle(box.number, e.target.checked)} />}
        {done.has(box.number) && following && (
          <Button variant="primary" onClick={() => setSelected(following.number)}>{t("Ir para a Box {n}", { n: following.number })}</Button>
        )}
      </Actions>
    </Panel>
  );
}

function AfterTyping({ base64 }: { base64: boolean }) {
  return (
    <Panel tour="codes-after">
      <h2>{t("Depois de digitar")}</h2>
      <p>{t("Os nomes sozinhos não fazem nada. O código só roda quando você dispara a ACE, movendo a 0x0351 no PC.")}</p>
      <Steps>
        <li><b>{t("Salve o jogo.")}</b> {t("Se algo der errado, é só reiniciar sem salvar para voltar a este ponto. Confira também se a Box 13, do slot 7 em diante, e as boxes seguintes estão vazias.")}</li>
        <li><b>{t("Dispare.")}</b> {t("No PC, em ")}<InGame>MOVE POKéMON</InGame>{t(", aperte ")}<Key>SELECT</Key>{t(": o cursor fica laranja. Pegue com ")}<Key>A</Key>{t(" um Pokémon qualquer, leve até a 0x0351 e aperte A para trocar; depois troque de novo. Nessa troca o jogo lê os nomes das boxes como código e roda. Pegue um Pokémon só, nunca um grupo: a comunidade relata que a 0x0351 some numa seleção em grupo.")}</li>
        <li><b>{t("Confira o resultado.")}</b> {base64
          ? t("O Pokémon do código aparece na Box 14, slot 30. Abra o resumo dele e compare com o que o site mostrou acima.")
          : t("O efeito depende do código: veja a descrição dele no gerador da comunidade (onde o Pokémon aparece, que item entra na mochila). O código de verificação da rota, por exemplo, põe um Pokémon na Box 9.")}</li>
        <li><b>{t("Deu certo? Salve.")}</b> {t("Travou, saiu Bad Egg ou dados trocados? Reinicie sem salvar e confira aqui a digitação de cada box.")}</li>
        <li><b>{t("Repetir ou trocar de código.")}</b> {t("Os nomes continuam nas boxes: disparar de novo roda o mesmo código. Antes, tire do lugar o que ele criou (por exemplo, o Pokémon da Box 14, slot 30). Para outro código, renomeie as boxes com os nomes novos.")}</li>
      </Steps>
      <Note>{t("Ainda sem a 0x0351? Veja ")}<Link to="/guides/ace">{t("Libere a ACE")}</Link>{t(". E não leve ao Pokémon HOME nada criado ou alterado assim (")}<Link to="/guides/safety">{t("Proteja o seu save")}</Link>{t(").")}</Note>
    </Panel>
  );
}

function Result({ result }: { result: svc.BoxNamesResult }) {
  const id = result.boxes.map((b) => b.name).join("\u0000");
  const [done, setDone] = useProgress(id);
  const natures = useMemo(() => rng.meta().natures, []);
  const toggle = (n: number, on: boolean) => {
    const next = new Set(done);
    if (on) next.add(n); else next.delete(n);
    setDone(next);
  };
  return (
    <Stack gap="sm">
      {result.code && ("error" in result.code && result.code.error ? (
        <Panel className="codes-summary bad"><h2>{t("Código Base64")}</h2><Notice tone="error">{result.code.error}</Notice></Panel>
      ) : "mon" in result.code && result.code.mon ? (
        <Stack gap="sm" className="code-mon">
          <Notice>{t("Estes nomes são um código do Base64 writer. Confira se o Pokémon abaixo é o que você quer: um erro de digitação no apelido, no OT ou no PID não é detectado sozinho.")}</Notice>
          <MonCard label={t("código Base64")} info={result.code.mon} natures={natures} />
        </Stack>
      ) : null)}
      <Panel className={`codes-summary ${result.ok ? "ok" : "bad"}`} tour="codes-summary">
        <div className="results-bar">
          <Tag tone={result.ok ? "ok" : "bad"}>{result.ok ? t("pode digitar") : t("corrija antes de digitar")}</Tag>
          <span className="count">{t("{done} de {total} boxes digitadas", { done: done.size, total: result.boxes.length })}</span>
          <Button size="sm" onClick={() => setDone(new Set())}>{t("Zerar progresso")}</Button>
        </div>
        {result.issues.length > 0 && <IssueList issues={result.issues} />}
        <Note>{t("Renomeie todas as boxes, da 1 até a última, inclusive as que só têm \"A\". Se o jogo não aceitar um nome, é o filtro de palavras do Switch: gere de novo na versão para o Switch ou converta a box.")}</Note>
      </Panel>
      <TypingPanel result={result} done={done} toggle={toggle} />
      <AfterTyping base64={!!result.code && "mon" in result.code && !!result.code.mon} />
    </Stack>
  );
}

// Browser only; title and intro live in the shell (pages/tools.tsx).
export function CodesTool() {
  const take = useCodes((s) => s.take);
  const [names, setNames] = useState("");
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<svc.BoxNamesResult | null>(null);
  const [error, setError] = useState("");

  const check = (namesText: string, rawText: string) => {
    if (!namesText.trim() && !rawText.trim()) {
      setError(t("Cole os nomes das boxes ou os bytes crus."));
      setResult(null);
      return;
    }
    try {
      setResult(svc.boxNames({ names: namesText, raw: rawText }));
      setError("");
    } catch (e) {
      setError((e as Error).message);
      setResult(null);
    }
  };

  // Tour example: only fills an empty field, so a pasted code is never overwritten.
  const example = useCodes((s) => s.example);
  useEffect(() => {
    if (!example) return;
    if (!names.trim()) setNames(example);
    useCodes.getState().suggest(null);
  }, [example]);   // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const pending = take();
    if (pending) {
      setNames(pending);
      setRaw("");
      check(pending, "");
    }
  }, [take]);

  return (
    <>
      <TourStart ids={["codes-typing"]} />
      <Notice tone="warn" title={t("Salve antes de disparar.")} tour="codes-safety">
        {t("Deixe vazia a Box 13 a partir do slot 7 e as boxes seguintes.")} <Link to="/guides/safety">{t("Proteja o seu save")}</Link>.
      </Notice>
      <Panel>
        <Steps>
        <li>{t("Tenha a ")}<Link to="/guides/ace">{t("ACE liberada")}</Link>{t(" no seu save.")}</li>
        <li>{t("Pegue o código: os nomes que a aba ")}<Link to="/editor">{t("Colocar no jogo")}</Link>{t(" gerou, ou um código do ")}
          <a href="https://e-sh4rk.github.io/CodeGenerator/index_frlg.html" target="_blank" rel="noopener">{t("gerador da comunidade")}</a>{t(" na versão ")}<b>eng10</b>.</li>
        <li>{t("Cole abaixo do jeito que veio. Se tiver os bytes crus (\"Raw data\"), cole também para uma conferência extra.")}</li>
        <li>{t("Digite caixa por caixa e vá marcando as prontas. O site lembra onde você parou.")}</li>
        <li>{t("Salve e dispare a ACE: o passo a passo aparece depois do teclado, em Depois de digitar.")}</li>
        </Steps>
      </Panel>
      <PanelForm tour="codes-input" onSubmit={() => check(names, raw)}>
        <div className="codes-inputs">
          <Field label={<>{t("Nomes das boxes (lista, \"Box N: ...\" ou um por linha; ")}<code>_</code>{t(" é espaço)")}</>}>
            <textarea className="mono" rows={8} spellCheck={false} placeholder='["FM.oZ.Bn", "D3n,E?q", ...]' value={names} onChange={(e) => setNames(e.target.value)} />
          </Field>
          <Field label={t("Bytes crus (opcional)")}>
            <textarea className="mono" rows={8} spellCheck={false} placeholder="C0 C7 AD E3 D4 AD BC E2 FF ..." value={raw} onChange={(e) => setRaw(e.target.value)} />
          </Field>
        </div>
        <Actions>
          <Button variant="primary" type="submit">{t("Conferir")}</Button>
          <Button onClick={() => { setNames(""); setRaw(""); setResult(null); setError(""); }}>{t("Limpar")}</Button>
        </Actions>
      </PanelForm>
      {error && <Notice tone="error">{error}</Notice>}
      {result && <Result result={result} />}
    </>
  );
}

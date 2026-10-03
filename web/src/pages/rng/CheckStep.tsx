// Check seed: caught wild Pokémon reveal the seed that came out, giving the timer correction and the learned offset.
// The seed can come out below the table value (docs/research/rng.md), so neighboring values are tried; a second
// Pokémon from the same attempt settles chance matches.

import { useEffect, useRef, useState } from "react";
import { getLang, t } from "../../i18n";
import { Actions, Button, Check, Field, Fields, Group, Hint, Key, Note, Notice, Panel, PanelForm, Progress, SearchProgress, Steps, Table } from "../../ui";
import { tx, withKeys } from "../../i18n/rich";
import { num, seconds, toDisplay } from "../../components/format";
import * as rng from "../../lib/services/rng";
import { Comlink, worker } from "../../lib/api";
import { Timer, type TimerFrame } from "../../lib/timer";
import { GBA_FPS } from "../../lib/rngflow";
import { useRng } from "./store";
import * as learned from "./learned";
import { SameWay } from "./SameWay";
import { TimerSettings } from "./TimerSettings";
import { CaughtMon, addLevel, emptyMon, monParams, type MonInput } from "./CaughtMon";
import { StepNeeds } from "./StepNeeds";

// Advances between title screen and encounter without marked times: 300 (cry, transition and menu) to 20,300
// (about 3 minutes).
const MIN_ADVANCE = 300;
const WINDOW = 10_000;
const CENTER = MIN_ADVANCE + WINDOW;
// Rows each way: near first, then wider; without marked times the advance range is large, so the wide search is
// smaller.
const LEEWAY = 10;
const WIDE_WITH_TIMES = 180;
const WIDE_WITHOUT_TIMES = 30;
// Two checks agreeing within this many ms confirm a correction.
const CONFIRM_MS = 50;
// VBlank can steal a roll in the middle of Pokémon generation (lib/gen3/rng.ts).
const METHODS = [1, 2, 4];
// About 4 minutes on the map.
const SECOND_WINDOW = 30_000;
const BUTTON: Record<string, string> = { a: "A", start: "START", l: "L" };
// About 1.5 s of stopwatch marking delay, in advances.
const MARK_SLACK = 90;

interface CheckRecord {
  /** Each timer Start. Finding again in the same attempt replaces the row. */
  attempt: number;
  chosen: string;
  hit: string;
  dms: number;
  dseed: number;
  advance: number;
  cont: number | null;
  battle: number | null;
  method: number;
  paired: boolean;
}

// Times in seconds since the title screen beep. Once per frame in the menu; on the map, twice per the ten-lines model
// (not verified), so 1 to 4 per frame are accepted after CONTINUE.
export function advanceRange(cont: number | null, battle: number | null): [number, number] | null {
  if (battle === null || !(battle > 0)) return null;
  if (cont !== null && cont > 0 && cont < battle) {
    const menu = cont * GBA_FPS, map = (battle - cont) * GBA_FPS;
    return [Math.max(0, Math.floor(menu * 0.97 + map - MARK_SLACK)), Math.ceil(menu * 1.03 + map * 4 + MARK_SLACK)];
  }
  return [Math.max(0, Math.floor(battle * GBA_FPS - MARK_SLACK)), Math.ceil(battle * GBA_FPS * 4 + MARK_SLACK)];
}

export function mapRate(advance: number, cont: number | null, battle: number | null): number | null {
  if (cont === null || battle === null || !(battle > cont)) return null;
  return (advance - cont * GBA_FPS) / ((battle - cont) * GBA_FPS);
}

const parseSeconds = (text: string) => {
  const value = Number(text.replace(",", "."));
  return text.trim() && Number.isFinite(value) && value > 0 ? value : null;
};

const signed = (n: number) => (n === 0 ? "0 ms" : `${n > 0 ? "+" : "-"}${num(Math.abs(n))} ms`);
const hex4 = (n: number) => (n & 0xffff).toString(16).toUpperCase().padStart(4, "0");
const key = (r: { seed_index: number; seed: string }) => `${r.seed_index}:${r.seed}`;

// `active`: the tab is visible (the space bar shortcut only works there).
export function CheckStep({ meta, active }: { meta: rng.Meta; active: boolean }) {
  const { chosen, timer, setTimer, choose } = useRng();
  const version = useRng((s) => s.game.version);

  const [frame, setFrame] = useState<TimerFrame | null>(null);
  const [running, setRunning] = useState(false);
  const [titleAt, setTitleAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [contAt, setContAt] = useState("");
  const [battleAt, setBattleAt] = useState("");
  const timerRef = useRef<Timer | null>(null);
  const attemptRef = useRef(0);
  useEffect(() => {
    timerRef.current = new Timer((f) => setFrame(f), (completed) => {
      setRunning(false);
      setFrame(null);
      if (completed) setTitleAt(performance.now());
    });
    return () => timerRef.current?.stop();
  }, []);
  const watching = titleAt !== null && !battleAt;
  useEffect(() => {
    if (!watching) return;
    let raf = 0;
    const loop = () => {
      setElapsed(performance.now() - titleAt!);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [watching, titleAt]);
  const mark = (which: "cont" | "battle") => {
    if (titleAt === null) return;
    const value = ((performance.now() - titleAt) / 1000).toFixed(1);
    if (which === "cont") setContAt(value);
    else setBattleAt(value);
  };
  const button = BUTTON[chosen?.setting.split("/")[2] ?? "a"] ?? "A";
  const phase = chosen ? { label: t("Aperte {button} no PRESS START", { button }), ms: chosen.ms + timer.cal1 } : null;
  const toggle = async () => {
    const clock = timerRef.current!;
    if (clock.running) return clock.stop();
    if (watching) return mark(contAt ? "battle" : "cont");
    if (!phase) return;
    setTitleAt(null);
    setContAt("");
    setBattleAt("");
    setElapsed(0);
    setRunning(true);
    attemptRef.current += 1;
    await clock.start([phase], timer);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!active || event.code !== "Space") return;
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag && ["INPUT", "SELECT", "TEXTAREA", "BUTTON"].includes(tag)) return;
      event.preventDefault();
      void toggle();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  });


  const [first, setFirst] = useState<MonInput>(emptyMon);
  const [second, setSecond] = useState<MonInput>(emptyMon);
  const [withSecond, setWithSecond] = useState(false);

  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ label: string; value: number } | null>(null);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{
    ivs: string; secondIvs: string | null; data: rng.CalibrateResult; range: [number, number] | null; wide: number | null;
  } | null>(null);
  const [history, setHistory] = useState<CheckRecord[]>([]);
  const [applied, setApplied] = useState("");
  const [learnedNote, setLearnedNote] = useState("");

  const discover = async () => {
    setError("");
    setResult(null);
    setApplied("");
    setLearnedNote("");
    try {
      if (!chosen) throw new Error(t("Escolha uma seed na etapa 1."));
      const one = monParams(meta, version, first);
      let two: ReturnType<typeof monParams> | null = null;
      if (withSecond) {
        try {
          two = monParams(meta, version, second, first.map);
        } catch (e) {
          throw new Error(t("Segundo Pokémon: {message}", { message: (e as Error).message }));
        }
      }
      const cont = parseSeconds(contAt), battle = parseSeconds(battleAt);
      const range = advanceRange(cont, battle);
      const [low, high] = range ? [Math.max(MIN_ADVANCE, range[0]), Math.max(MIN_ADVANCE, range[1])] : [MIN_ADVANCE, CENTER + WINDOW];
      const half = Math.min(20_000, Math.ceil((high - low) / 2));
      setBusy(true);
      const estimate = learned.estimate(chosen.game, chosen.setting, chosen.console, true);
      const search = (leeway: number, label: string) => {
        setProgress({ label, value: 0 });
        return worker().calibrate({
          game: chosen.game, console: chosen.console, target_index: chosen.index, ...estimate,
          target_advance: low + half, window: half, leeway, methods: METHODS, kind: "wild", ...one.params,
          ...(two ? { second: { ...two.params, window: SECOND_WINDOW } } : {}),
        }, getLang(), Comlink.proxy((done: number, total: number) => setProgress({ label, value: done / total })));
      };
      let data = await search(LEEWAY, t("Procurando perto da seed escolhida"));
      let wide: number | null = null;
      if (!data.results.length) {
        wide = range ? WIDE_WITH_TIMES : WIDE_WITHOUT_TIMES;
        data = await search(wide, t("Nada perto: procurando até {time} para cada lado", { time: seconds(Math.round(wide * 1000 / GBA_FPS)) }));
      }
      setResult({ ivs: one.ivs, secondIvs: two?.ivs ?? null, data, range, wide });
      const best = data.results[0];
      if (best && new Set(data.results.map(key)).size === 1) {
        const record: CheckRecord = {
          attempt: attemptRef.current, chosen: chosen.seed, hit: best.seed, dms: best.dms, dseed: best.dseed ?? 0, advance: best.advance, cont, battle,
          method: best.method ?? 1, paired: two !== null,
        };
        const next = [...history.filter((h) => h.attempt !== record.attempt), record];
        setHistory(next);
        const agreeing = next.filter((h) => Math.abs(h.dms - record.dms) <= CONFIRM_MS);
        if (record.paired || agreeing.length >= 2) {
          const total = learned.record(chosen.game, chosen.setting, chosen.console, { index: best.seed_index, dseed: record.dseed });
          choose(learned.refreshed(chosen));
          setLearnedNote(t("Deslocamento guardado ({n} conferência(s) no total): a lista de seeds e as buscas já usam ele.", { n: total }));
        }
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      setProgress(null);
    }
  };

  const found = result ? [...new Set(result.data.results.map(key))] : [];
  const best = result?.data.results[0];
  const unique = found.length === 1;
  const paired = unique && result?.secondIvs !== null;
  const agreeing = best && unique ? history.filter((h) => Math.abs(h.dms - best.dms) <= CONFIRM_MS) : [];
  const confirmedDms = !best || !unique ? null
    : paired ? best.dms
    : agreeing.length >= 2 ? Math.round(agreeing.reduce((sum, h) => sum + h.dms, 0) / agreeing.length) : null;
  const tableSeed = best ? hex4(parseInt(best.seed, 16) - (best.dseed ?? 0)) : "";
  const wideTime = result?.wide ? seconds(Math.round(result.wide * 1000 / GBA_FPS)) : "";
  const shiftNow = chosen ? learned.shift(learned.points(chosen.game, chosen.setting, chosen.console)) : 0;

  return (
    <>
      <Panel className="timer-panel" tour="rng-check-timer">
        <StepNeeds needs={["seed"]} />
        <Hint>{tx("Calibra o timer antes do RNG de verdade, sem precisar de alvo: um bipe no PRESS START e os Pokémon selvagens que você capturar depois mostram em que seed você caiu. Com isso, o site mede quanto o seu aperto cai antes ou depois (e corrige o timer) e aprende quanto a seed do seu console fica diferente da tabela. Refaça quando mudar o jeito de começar o timer, de console ou de versão do jogo.")}</Hint>
        {chosen && (
          <p className="chosen">
            {t("Seed escolhida: ")}<b className="mono">{chosen.seed}</b>{t(", apertando aos {time}. ", { time: seconds(chosen.ms) })}
          </p>
        )}
        <SameWay />
        <Steps>
          <li>{t("Salve no lugar onde vai procurar o Pokémon e feche o jogo.")}</li>
          <li>{t("Abra o jogo e clique em Começar do seu jeito de sempre (veja o aviso acima).")}</li>
          <li>{tx("Na tela de título (a do logo do jogo com PRESS START), aperte {button} no último bipe (o mais agudo).", { button: <Key>{button}</Key> })}</li>
          <li>{tx("O timer segue contando. Aperte espaço ao entrar em CONTINUE e de novo quando a batalha começar (no flash). A reprise \"Previously on your quest\" pode ser pulada com {b}. Não precisa correr: os tempos só limitam a busca.", { b: <Key>B</Key> })}</li>
          <li>{t("Capture o primeiro Pokémon que aparecer. Fugir de outros antes faz o jogo avançar mais do que a busca cobre.")}</li>
          <li>{t("Se puder, capture também o segundo Pokémon que aparecer, na mesma tentativa: com dois, o resultado sai quase sempre certo.")}</li>
          <li>{t("Preencha abaixo o que você pegou e clique em Descobrir. Depois, reinicie sem salvar: a seed não fica no save (ela sai de novo a cada vez que você abre o jogo), e assim a próxima tentativa começa do mesmo ponto. Se quiser ficar com os Pokémon, salve, mas volte ao ponto de partida e salve lá antes da próxima.")}</li>
        </Steps>
        {frame && timerRef.current?.muted && <Notice tone="warn">{t("Sem som: o navegador não liberou o áudio nesta rodada. Siga pela tela, que pisca nos bipes, ou pare e comece de novo.")}</Notice>}
        <div className={`timer-display ${frame?.flashing ? "flash" : ""}`}>
          <div className="timer-phase">{frame && phase ? withKeys(phase.label, [button])
            : watching ? (contAt ? t("Marque quando a batalha começar (o flash)") : tx("Marque quando entrar em CONTINUE"))
            : battleAt ? t("Tempos marcados: preencha o Pokémon abaixo") : t("Pronto")}</div>
          <div className="timer-clock mono">{watching || battleAt
            ? seconds(Math.round(watching ? elapsed : (parseSeconds(battleAt) ?? 0) * 1000))
            : seconds(Math.max(0, Math.round(frame?.remaining ?? phase?.ms ?? 0)))}</div>
          {!watching && !battleAt && <Progress value={frame?.fraction ?? 0} />}
        </div>
        <Actions>
          <Button variant="primary" size="lg" disabled={!phase} onClick={() => void toggle()}>
            {running ? t("Parar") : watching ? (contAt ? t("A batalha começou") : t("Entrei em CONTINUE")) : titleAt !== null ? t("Começar de novo") : t("Começar")}
          </Button>
          {watching && !contAt && <Button size="sm" onClick={() => mark("battle")}>{t("Pulei a marca do CONTINUE: a batalha começou")}</Button>}
          <Note inline>{t("Atalho: barra de espaço")}</Note>
          {timer.cal1 !== 0 && <Note inline>{t("Com ajuste da etapa 1: {ms}.", { ms: signed(timer.cal1) })}</Note>}
        </Actions>
        <TimerSettings check />
      </Panel>

      <PanelForm tour="rng-check-form" onSubmit={() => void discover()}>
        <h2>{t("O Pokémon que você capturou")}</h2>
        <Fields>
          <Field label={tx("CONTINUE aos (s)")}>
            <input inputMode="decimal" placeholder={t("opcional")} value={contAt} onChange={(e) => setContAt(e.target.value)} />
          </Field>
          <Field label={t("Batalha aos (s)")}>
            <input inputMode="decimal" placeholder={t("opcional")} value={battleAt} onChange={(e) => setBattleAt(e.target.value)} />
          </Field>
        </Fields>
        <CaughtMon meta={meta} version={version} value={first} onChange={setFirst} />
        <Actions>
          <Button size="sm" onClick={() => setFirst(addLevel(first))}>{t("Mais um nível")}</Button>
        </Actions>
        <Note>{tx("A primeira linha é o nível em que você capturou, com os stats de logo depois da captura. Em nível baixo, vários IVs dão o mesmo stat: suba o Pokémon de nível e acrescente os stats novos em outra linha; um salto grande (5 níveis ou mais) ajuda mais que níveis seguidos. Com Rare Candy os stats saem exatos; batalhando, marque a opção acima, porque cada nocaute dá EVs que mexem um pouco nos stats.")}</Note>
        <Check label={t("Capturei um segundo Pokémon na mesma tentativa")} checked={withSecond} onChange={(e) => setWithSecond(e.target.checked)} />
        {withSecond && (
          <Group title={t("Segundo Pokémon (o que apareceu depois do primeiro)")}>
            <CaughtMon meta={meta} version={version} value={second} onChange={setSecond} fallbackMap={first.map} />
            <Actions>
              <Button size="sm" onClick={() => setSecond(addLevel(second))}>{t("Mais um nível")}</Button>
            </Actions>
            <Note>{t("Não precisa marcar o tempo dele: basta ter aparecido depois do primeiro, sem reiniciar o jogo.")}</Note>
          </Group>
        )}
        <Actions>
          <Button variant="primary" type="submit" disabled={busy || !chosen}>{busy ? t("Procurando...") : t("Descobrir")}</Button>
        </Actions>
        {progress && (
          <>
            <Note>{`${progress.label}: ${Math.round(progress.value * 100)}%`}</Note>
            <SearchProgress value={progress.value} label={progress.label} running={busy} />
          </>
        )}
        {shiftNow !== 0 && (
          <Note>{t("A busca parte do deslocamento que você já conferiu: {shift} em relação à tabela.", { shift: shiftNow > 0 ? `+${shiftNow}` : String(shiftNow) })}</Note>
        )}
      </PanelForm>

      {error && <Notice tone="error">{error}</Notice>}
      {result && (best ? (
        <Panel>
          {result.wide !== null && !paired && (
            <Notice tone="warn" title={t("Achado longe da seed escolhida (mais de 0,17 s).")}>
              {t("Nada bateu perto, então a busca foi até {time} para cada lado. Tão longe, a chance de uma seed bater por acaso é bem maior: só confie se outra conferência der a mesma diferença, ou confira com dois Pokémon.", { time: wideTime })}
            </Notice>
          )}
          {unique ? (
            <Notice tone={best.dms === 0 && best.dseed === 0 ? "tip" : "note"} title={best.dms === 0
              ? t("Bateu no tempo: o seu aperto caiu no instante da seed {chosen}.", { chosen: chosen!.seed })
              : best.dms > 0
                ? tx("O seu aperto de {button} na tela de título caiu {diff} depois do previsto.", { button: <Key>{button}</Key>, diff: seconds(best.dms) })
                : tx("O seu aperto de {button} na tela de título caiu {diff} antes do previsto.", { button: <Key>{button}</Key>, diff: seconds(-best.dms) })}>
              <p>{(best.dseed ?? 0) === 0
                ? t("Saiu a seed {seed}, exatamente o valor da tabela para esse instante.", { seed: best.seed })
                : t("Saiu a seed {seed}: {n} {dir} do valor da tabela para esse instante ({table}).", {
                  seed: best.seed, n: Math.abs(best.dseed!), dir: best.dseed! < 0 ? t("abaixo") : t("acima"), table: tableSeed })}</p>
              {best.second && (
                <p>{t("O segundo Pokémon bate na mesma seed, {n} avanços de frame depois do primeiro: resultado confirmado.", { n: num(best.second.advance - best.advance) })}</p>
              )}
              {learnedNote && <p>{learnedNote}</p>}
              {best.dms !== 0 && (confirmedDms === null
                ? <p>{t("Uma medição sozinha pode ser acaso. Repita (a mesma seed serve: clique em Começar de novo e capture outro Pokémon), começando o timer do mesmo jeito, ou capture dois Pokémon na mesma tentativa. Quando duas conferências derem a mesma diferença, com até 50 ms de folga, o botão de corrigir aparece.")}</p>
                : !paired && <p>{t("Confirmado: {n} conferências deram essa diferença (até 50 ms de folga). Pode corrigir o timer e conferir mais uma vez: deve bater.", { n: agreeing.length })}</p>)}
            </Notice>
          ) : (
            <Notice tone="warn" title={t("Ainda não dá para ter certeza: {n} seeds explicam esse Pokémon.", { n: found.length })}>
              {result.secondIvs === null
                ? t("O melhor jeito de desempatar é um segundo Pokémon da mesma tentativa: na próxima vez, capture também o que aparecer depois do primeiro e marque \"Capturei um segundo Pokémon\". Subir o Pokémon de nível também ajuda (um salto de 5 níveis ou mais).")
                : tx("Mesmo com os dois Pokémon sobrou mais de uma seed. Suba um deles de nível (de preferência com Rare Candy), acrescente os stats novos e descubra de novo.")}
            </Notice>
          )}
          {unique && confirmedDms !== null && confirmedDms !== 0 && (
            <Actions>
              <Button onClick={() => {
                const total = timer.cal1 - confirmedDms;
                setTimer({ cal1: total });
                setApplied(total === 0 ? t("Pronto: o bipe voltou ao tempo da tabela.")
                  : total < 0 ? t("Pronto: no total, o bipe da tela de título agora toca {diff} mais cedo que a tabela.", { diff: seconds(-total) })
                  : t("Pronto: no total, o bipe da tela de título agora toca {diff} mais tarde que a tabela.", { diff: seconds(total) }));
              }}>
                {confirmedDms > 0 ? t("Corrigir: bipe {diff} mais cedo", { diff: seconds(confirmedDms) }) : t("Corrigir: bipe {diff} mais tarde", { diff: seconds(-confirmedDms) })}
              </Button>
              {applied && <Note inline>{applied}</Note>}
            </Actions>
          )}
          <Table>
            <thead><tr><th>seed</th><th>{t("tabela")}</th><th>{t("diferença")}</th><th>{t("avanço de frame")}</th><th>{t("método")}</th><th>nature</th><th>IVs</th>{result.secondIvs !== null && <th>{t("segundo")}</th>}</tr></thead>
            <tbody>
              {result.data.results.slice(0, 10).map((r) => (
                <tr key={`${key(r)}-${r.advance}-${r.method}`} className={r === best ? "row-chosen" : undefined}>
                  <td className="mono">{r.seed}</td>
                  <td className="mono">{hex4(parseInt(r.seed, 16) - (r.dseed ?? 0))}{r.dseed ? ` (${r.dseed > 0 ? "+" : ""}${r.dseed})` : ""}</td>
                  <td>{signed(r.dms)}</td><td>{num(r.advance)}</td><td>H{r.method ?? 1}</td><td>{r.nature}</td>
                  <td className="mono">{toDisplay(r.ivs).join("/")}</td>
                  {result.secondIvs !== null && <td>{r.second ? t("avanço de frame {n}, H{m}", { n: num(r.second.advance), m: r.second.method }) : "-"}</td>}
                </tr>
              ))}
            </tbody>
          </Table>
          <Note>{result.secondIvs === null
            ? t("IVs possíveis pelos stats: {ivs}.", { ivs: result.ivs })
            : t("IVs possíveis pelos stats: {ivs} (primeiro) e {second} (segundo).", { ivs: result.ivs, second: result.secondIvs })}</Note>
          {result.range && (
            <Note>{t("Busca só nos avanços de frame que cabem nos tempos marcados: de {min} a {max}.", { min: num(result.range[0]), max: num(result.range[1]) })}</Note>
          )}
        </Panel>
      ) : (
        <Notice tone="warn" title={t("Nada até {time} antes ou depois da seed escolhida.", { time: seconds(Math.round((result.wide ?? LEEWAY) * 1000 / GBA_FPS)) })}>
          {tx("Ou o seu aperto caiu mais longe que isso, ou algum dado está diferente. Confira os stats (um número errado basta), a espécie, a nature, o gênero, se o menu OPTION do jogo é o mesmo de \"Seu jogo\" e se o botão foi no último bipe, o mais agudo. Use o primeiro Pokémon que aparecer depois do CONTINUE: fugir de outros encontros antes faz o avanço de frame passar do que a busca cobre. Sem os tempos marcados, a busca vai menos longe: marque o CONTINUE e a batalha.")}
        </Notice>
      ))}

      {history.length > 0 && (
        <Panel>
          <h2>{t("Conferências desta sessão")}</h2>
          <Table>
            <thead><tr><th>{t("escolhida")}</th><th>{t("saiu")}</th><th>{t("diferença")}</th><th>{t("valor")}</th><th>{t("avanço de frame")}</th><th>{t("método")}</th><th>CONTINUE</th><th>{t("batalha")}</th><th>{t("avanços por frame no mapa")}</th></tr></thead>
            <tbody>{history.map((h, i) => {
              const rate = mapRate(h.advance, h.cont, h.battle);
              return (
                <tr key={i}>
                  <td className="mono">{h.chosen}</td><td className="mono">{h.hit}{h.paired ? ` (${t("dois Pokémon")})` : ""}</td><td>{signed(h.dms)}</td>
                  <td>{h.dseed > 0 ? `+${h.dseed}` : h.dseed}</td><td>{num(h.advance)}</td><td>H{h.method}</td>
                  <td>{h.cont === null ? "-" : `${h.cont.toFixed(1)} s`}</td><td>{h.battle === null ? "-" : `${h.battle.toFixed(1)} s`}</td>
                  <td>{rate === null ? "-" : rate.toFixed(2)}</td>
                </tr>
              );
            })}</tbody>
          </Table>
          <Note>{t("Valor: quanto a seed que saiu ficou acima ou abaixo da tabela da comunidade naquele instante.")}</Note>
          <Note>{t("Avanços por frame no mapa: estimativa a partir dos tempos marcados (o menu conta 1 por frame). O modelo usado no timer supõe 2; valores parecidos em várias conferências confirmam ou corrigem isso.")}</Note>
          <Note>{t("Fica só enquanto a página está aberta. Para mandar os resultados, copie esta tabela.")}</Note>
        </Panel>
      )}
    </>
  );
}

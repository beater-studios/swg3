// Send to game tab: Base64 writer, community code plan, ESP32 board recipe and file download.

import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { t } from "../../i18n";
import { highlight } from "../../i18n/rich";
import { Actions, Button, Check, Field, Fields, Note, Notice, Panel, PanelSection, Radios, Segmented, Table, Tag } from "../../ui";
import { Downloads } from "../../components/MonCard";
import { download, pretty } from "../../components/format";
import * as svc from "../../lib/services/pokemon";
import type { Plan } from "../../lib/gen3/codeplan";
import type { Recipe } from "../../lib/recipe";
import type { EncodedDict } from "../../lib/gen3/base64box";
import { useCodes } from "../codes/store";
import { usePokemon } from "./store";
import { fileName } from "../../brand";

function Base64Block({ hex }: { hex: string }) {
  const [switchSafe, setSwitchSafe] = useState(true);
  const [convert, setConvert] = useState<number[]>([]);
  const [box, setBox] = useState("1");
  const [result, setResult] = useState<EncodedDict | null>(null);
  const [error, setError] = useState("");
  const open = useCodes((s) => s.open);
  const navigate = useNavigate();

  const generate = (safe: boolean, boxes: number[]) => {
    try {
      setResult(svc.base64Boxes({ hex, switch_safe: safe, convert: boxes }));
      setConvert(boxes);
      setError("");
    } catch (e) {
      setError((e as Error).message);
    }
  };
  const shortened = new Set(result?.shortened ?? []);

  return (
    <PanelSection tour="editor-send-writer">
      <h2>{t("Digitando no jogo: Base64 writer")}</h2>
      <p>{t("Se você já instalou o Base64 writer, este Pokémon vira 14 nomes de box. Um disparo e ele aparece na Box 14, slot 30, igual ao que está aqui, com nature, OT e apelido.")}</p>
      <Note items={[
        <>{t("Ainda não tem o writer? Veja ")}<Link to="/guides/base64">{t("como instalar")}</Link>.</>,
        t("Deixe vazio da 2ª linha da Box 13 até o slot 30 da Box 14, fora as peças do writer."),
        t("A versão para o Switch arruma os nomes para passar no filtro de palavras, sem mudar o Pokémon."),
      ]} />
      <form onSubmit={(e) => { e.preventDefault(); generate(switchSafe, []); }}>
        <Fields>
          <Check label={t("Versão para o Switch")} checked={switchSafe} onChange={(e) => setSwitchSafe(e.target.checked)} />
          <Actions><Button variant="primary" type="submit">{t("Gerar os nomes")}</Button></Actions>
        </Fields>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {result && (
        <div className="plan">
          <Table>
              <thead><tr><th>box</th><th>{t("nome")}</th><th>{t("observação")}</th></tr></thead>
              <tbody>
                {result.boxes.map((name, i) => {
                  const n = i + 1;
                  const notes = [
                    shortened.has(n) ? t("encurtada: não complete com espaço") : "",
                    result.manual[n] !== undefined ? t("{n} maiúscula(s) convertida(s)", { n: result.manual[n] }) : "",
                    result.blocked[String(n)] ? t("o filtro ainda deve recusar ({terms})", { terms: result.blocked[String(n)].join(", ") }) : "",
                  ].filter(Boolean);
                  return (
                    <tr key={n} className={result.blocked[String(n)] ? "row-bad" : undefined}>
                      <th scope="row">Box {n}</th><td className="mono b64">{name || t("(vazia)")}</td><td className="muted">{notes.join("; ")}</td>
                    </tr>
                  );
                })}
              </tbody>
          </Table>
          <Actions>
            <Button variant="primary" onClick={() => { open(JSON.stringify(result.boxes)); navigate("/codes"); }}>{t("Conferir e digitar")}</Button>
            <Button onClick={() => void navigator.clipboard?.writeText(result.boxes.map((b, i) => `Box ${i + 1}: (${b})`).join("\n"))}>{t("Copiar")}</Button>
          </Actions>
          {switchSafe && (
            <form onSubmit={(e) => { e.preventDefault(); generate(true, [...new Set([...convert, Number(box)])]); }}>
              <Fields>
              <Field label={t("O Switch recusou uma box? Converta as maiúsculas dela")}>
                <select value={box} aria-label={t("Box recusada")} onChange={(e) => setBox(e.target.value)}>
                  {result.boxes.map((name, i) => (name ? <option key={i} value={i + 1}>Box {i + 1}</option> : null))}
                </select>
              </Field>
              <Actions><Button type="submit">{t("Converter")}</Button></Actions>
              </Fields>
            </form>
          )}
          <Note>{t("Caracteres parecidos: O maiúsculo e 0 (zero), l minúsculo e I maiúsculo, aspas curvas de abrir e fechar. A página Códigos mostra a tecla exata de cada um.")}</Note>
        </div>
      )}
    </PanelSection>
  );
}

function PlanView({ plan }: { plan: Plan }) {
  return (
    <div className="plan">
      <h3>{t("Antes de começar")}</h3>
      <ul>{plan.requirements.map((r) => <li key={r}>{r}</li>)}</ul>
      <p>{t("Gere cada código em ")}<a href={plan.generator} target="_blank" rel="noopener">CodeGenerator (FRLG)</a>{t(", versão eng10, e confira os nomes na página ")}<Link to="/codes">{t("Códigos")}</Link>{t(" antes de digitar.")}</p>
      <ol className="plan-steps">
        {plan.steps.map((step, i) => (
          <li className="plan-step" key={i}>
            <h4>{step.code}</h4>
            <p className="muted">{t("Onde: {target} · saída: {exit} · caixas: {boxes} · arquivo {file}", { target: step.target, exit: step.exit, boxes: step.boxes, file: step.file })}</p>
            {step.params.length > 0 && (
              <Table>
                <thead><tr><th>{t("parâmetro")}</th><th>{t("valor")}</th><th>{t("nota")}</th></tr></thead>
                <tbody>{step.params.map((p) => <tr key={p.name}><td className="mono">{p.name}</td><td>{p.value ?? ""}</td><td className="muted">{p.note ?? ""}</td></tr>)}</tbody>
              </Table>
            )}
            {step.notes.length > 0 && <ul>{step.notes.map((n) => <li key={n}>{highlight(n)}</li>)}</ul>}
          </li>
        ))}
      </ol>
      <h3>{t("O que os códigos não cobrem")}</h3>
      <ul>{plan.not_covered.map((n) => <li key={n}>{n}</li>)}</ul>
      <h3>{t("Avisos")}</h3>
      <ul>{plan.warnings.map((n) => <li key={n}>{n}</li>)}</ul>
    </div>
  );
}

function PlanBlock({ hex }: { hex: string }) {
  const [strategy, setStrategy] = useState("wild");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [error, setError] = useState("");
  return (
    <PanelSection>
      <h2>{t("Digitando no jogo, sem o writer")}</h2>
      <p>{t("Dá para chegar perto usando só os códigos do gerador da comunidade: um cria o Pokémon e os outros ajustam cada parte. Nature, apelido e OT não têm código, então ficam como saírem. O plano mostra os códigos na ordem, já com os valores.")}</p>
      <form onSubmit={(e) => {
        e.preventDefault();
        try { setPlan(svc.codePlan({ hex, strategy })); setError(""); } catch (err) { setError((err as Error).message); }
      }}>
        <Fields>
          <Radios legend={t("Como o Pokémon nasce")} name="strategy" value={strategy} onChange={setStrategy} options={[
            { value: "wild", label: t("Numa batalha selvagem, e você captura (a nature é sorteada)") },
            { value: "egg", label: t("Num ovo com o PID certo (mantém nature, gênero e Ability)") },
          ]} />
          <Actions><Button variant="primary" type="submit">{t("Ver o plano")}</Button></Actions>
        </Fields>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {plan && <PlanView plan={plan} />}
    </PanelSection>
  );
}

function RecipeView({ recipe, withDownload }: { recipe: Recipe; withDownload: boolean }) {
  const name = fileName(`receita-${recipe.offer.species_name.toLowerCase()}.json`);
  return (
    <div className="plan">
      <p>
        {t("Troca em {game} ({language}, revisão {revision}): o PC oferece {offer}", {
          game: recipe.game.title === "leafgreen" ? "LeafGreen" : "FireRed", language: recipe.game.language,
          revision: recipe.game.revision, offer: pretty(recipe.offer.nickname || recipe.offer.species_name),
        })}
        {recipe.offer.evolves_to ? t(", que evolui para {name} ao chegar", { name: pretty(recipe.offer.evolves_to) }) : ""}
        {recipe.receive ? t(", e guarda o seu em {file}.", { file: recipe.receive.save_as }) : "."}
      </p>
      <ol className="recipe-steps">
        {recipe.steps.map((s, i) => <li key={i}><Tag tone={s.who === "pc" ? "warn" : "ok"}>{s.who === "pc" ? "PC" : t("você")}</Tag> {s.text}</li>)}
      </ol>
      <Note items={recipe.notes} />
      {withDownload && (
        <Actions>
          <Button variant="primary" onClick={() => download(name, JSON.stringify(recipe, null, 2) + "\n", "application/json")}>{t("Baixar receita (.json)")}</Button>
        </Actions>
      )}
    </div>
  );
}

function RecipeBlock({ hex }: { hex: string }) {
  const [game, setGame] = useState("firered");
  const [saveAs, setSaveAs] = useState("recebido.pk3");
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [error, setError] = useState("");
  return (
    <PanelSection>
      <h2>{t("Com a placa ESP32")}</h2>
      <p>{t("Gere a receita: ela diz ao programa do PC qual Pokémon oferecer na troca e onde guardar o que você mandar, e mostra o que fazer em cada etapa. O programa do PC ainda está sendo feito.")}</p>
      <form onSubmit={(e) => {
        e.preventDefault();
        try { setRecipe(svc.recipeTrade({ hex, game, save_as: saveAs })); setError(""); } catch (err) { setError((err as Error).message); }
      }}>
        <Fields>
        <Segmented label={t("Jogo")} name="recipe-game" value={game} onChange={setGame} options={[
          { value: "firered", label: "FireRed", icon: "flame", tone: "fire" },
          { value: "leafgreen", label: "LeafGreen", icon: "leaf", tone: "leaf" },
        ]} />
        <Field label={t("Salvar o que você mandar como")}><input value={saveAs} onChange={(e) => setSaveAs(e.target.value)} /></Field>
        <Actions><Button variant="primary" type="submit">{t("Gerar receita")}</Button></Actions>
        </Fields>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      {recipe && <RecipeView recipe={recipe} withDownload />}
    </PanelSection>
  );
}

function CheckRecipe() {
  const [result, setResult] = useState<Recipe | null>(null);
  const [error, setError] = useState("");
  return (
    <PanelSection>
      <h2>{t("Conferir uma receita")}</h2>
      <Field label={t("Arquivo .json")}>
        <input type="file" accept=".json,application/json" onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try { setResult(svc.recipeCheck({ text: await file.text() }).recipe as unknown as Recipe); setError(""); } catch (err) { setResult(null); setError(`${file.name}: ${(err as Error).message}`); }
        }} />
      </Field>
      {error && <Notice tone="error">{error}</Notice>}
      {result && <RecipeView recipe={result} withDownload={false} />}
    </PanelSection>
  );
}

export function SendTab() {
  const current = usePokemon((s) => s.current);
  const hex = current?.info.files?.game;
  const errors = current ? current.info.issues.filter((i) => i.level === "error").length : 0;
  return (
    <>
      <Panel>
        <Notice tone="warn" title={t("Antes de colocar qualquer coisa no jogo:")}>
          {t("salve, deixe vazia a Box 13 a partir do slot 7 e as boxes seguintes, e não leve Pokémon criados aqui para o Pokémon HOME.")} <Link to="/guides/safety">{t("Por quê")}</Link>.
        </Notice>
        {!current || !hex ? (
          <p>{t("Abra um arquivo na aba Abrir ou crie um Pokémon em Criar ou editar, e clique em Colocar no jogo.")}</p>
        ) : (
          <div className="send-summary">
            <b>{`${current.info.nickname} (${pretty(current.info.species.name)})`}</b>
            <span>{t(" nível {level}, {nature}{shiny}, PID {pid}, OT {ot} {tid}/{sid}", {
              level: current.info.level ?? "?", nature: current.info.nature, shiny: current.info.shiny ? ", shiny" : "",
              pid: current.info.pid, ot: current.info.ot_name, tid: current.info.tid, sid: current.info.sid,
            })}</span>
            <Tag tone={errors ? "bad" : "ok"}>{errors ? t("{n} erro(s): corrija antes de colocar no jogo", { n: errors }) : t("sem erros")}</Tag>
            <span className="muted">{` · ${current.label}`}</span>
          </div>
        )}
      </Panel>
      {current && hex && (
        <>
          <Base64Block key={`b-${hex}`} hex={hex} />
          <PlanBlock key={`p-${hex}`} hex={hex} />
          <RecipeBlock key={`r-${hex}`} hex={hex} />
          <PanelSection>
            <h2>{t("Só o arquivo")}</h2>
            <p>{t("Baixe para guardar ou abrir em outro programa.")}</p>
            <Downloads base={current.label.replace(/\.[^.]+$/, "")} files={current.info.files!} />
          </PanelSection>
        </>
      )}
      <CheckRecipe />
    </>
  );
}

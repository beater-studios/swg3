// Design system catalog (/design, dev only): tokens, components with live examples and a page skeleton.

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Actions, Button, ButtonLink, CardGrid, Check, Chip, Chips, ClientOnly, Combobox, Details, Dialog, EmptyState, Field, Fields, FileDrop, Flag, Gender, GenderChoice, Group, Hint, Icon, ICON_NAMES, InGame, IssueLegend, IssueList, Item, ItemIcon, Key, KV, LinkCard, Mark, MenuButton, MonIcon, MoveCategoryIcon, MoveLabel, Note, Notice, NumberInput, OptionCard, OptionChip, Page, PageHeader, Panel, Prereq, Progress, Radios, RibbonIcon, RibbonList, SearchProgress, Segmented, Stack, summonMew, StatChange, Steps, Table, TabPanel, Tabs, Tag, Term, Tour, TYPE_COLORS, TypeBadge,
} from "../ui";
import { MonCard } from "../components/MonCard";
import { TownMap } from "../components/TownMap";
import { PcBoxTitle, TypingGuide } from "../components/NamingScreen";
import { MailGlitch } from "../components/MailGlitch";
import { typingSteps } from "../lib/gen3/boxnames";
import { BRAND_NAME } from "../brand";
import { GAMES } from "../games";
import * as svc from "../lib/services/pokemon";
import * as rng from "../lib/services/rng";
import "./design.css";

function GenderDemo() {
  const [gender, setGender] = useState("");
  const [trainer, setTrainer] = useState("0");
  return (
    <Fields>
      <GenderChoice label="Gender" value={gender} onChange={setGender} options={[
        { value: "", label: "any", gender: null }, { value: "M", label: "male", gender: "M" }, { value: "F", label: "female", gender: "F" },
      ]} />
      <GenderChoice label="OT gender" value={trainer} onChange={setTrainer} options={[
        { value: "0", label: "boy", gender: "M" }, { value: "1", label: "girl", gender: "F" },
      ]} />
      <GenderChoice label="Gender (Magnemite)" value="-" disabled onChange={() => undefined} options={[{ value: "-", label: "genderless", gender: "-" }]} />
    </Fields>
  );
}

function DialogDemo() {
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);
  return (
    <Actions>
      <Button size="sm" onClick={() => setOpen(true)}>Open the map</Button>
      {picked && <span>Picked: section {picked}</span>}
      <Dialog open={open} onClose={() => setOpen(false)} title="Region map" className="townmap-dialog">
        <TownMap value={88} choices={(section) => [{ value: String(section), label: String(section) }]} marked={new Set([101, 102])}
          onPick={(value) => { setPicked(value); setOpen(false); }} />
      </Dialog>
    </Actions>
  );
}

function TourDemo() {
  const [index, setIndex] = useState<number | null>(null);
  const steps = [
    { target: "demo-tour-a", html: "<p>This is the first highlighted element. Click <strong>Next</strong>.</p>" },
    { target: "demo-tour-b", html: "<p>And this is the second. The box follows the element, and Esc closes it.</p>" },
  ];
  return (
    <Stack gap="sm">
      <Actions>
        <span data-tour="demo-tour-a"><Button onClick={() => setIndex(0)}>Start the Tour</Button></span>
        <span data-tour="demo-tour-b"><Tag tone="ok">second target</Tag></span>
      </Actions>
      {index !== null && (
        <Tour step={steps[index]} index={index} total={steps.length} title="Demo"
          onNext={() => setIndex(index + 1 < steps.length ? index + 1 : null)} onBack={() => setIndex(Math.max(0, index - 1))} onExit={() => setIndex(null)} />
      )}
    </Stack>
  );
}

function OptionCardDemo() {
  const [chosen, setChosen] = useState("pidgey");
  const [level, setLevel] = useState(0);
  return (
    <div className="option-cards">
      <OptionCard selected={chosen === "pidgey"} onSelect={() => setChosen("pidgey")} title="Pidgey" aside="50%"
        meta={<><TypeBadge type="Normal" /><TypeBadge type="Flying" /></>}>
        {[2, 3, 4].map((n) => <OptionChip key={n} selected={chosen === "pidgey" && level === n} onClick={() => { setChosen("pidgey"); setLevel(level === n ? 0 : n); }}>Lv. {n}</OptionChip>)}
      </OptionCard>
      <OptionCard selected={chosen === "magikarp"} onSelect={() => setChosen("magikarp")} title="Magikarp" aside="100%" meta={<TypeBadge type="Water" />}>
        <OptionChip>Lv. 5 to 10</OptionChip>
      </OptionCard>
    </div>
  );
}

function MenuDemo() {
  const [value, setValue] = useState<string>("fire");
  const game = GAMES.find((g) => g.accent === value)!;
  return (
    <Actions>
      <MenuButton label="Game theme" value={value} onChange={setValue} className={`accent-${value}`}
        options={GAMES.map((g) => ({ value: g.accent, label: g.name, icon: <span className={`accent-${g.accent}`}><Icon name={g.icon} /></span> }))}>
        <Icon name={game.icon} />
      </MenuButton>
      <span>{game.name}</span>
    </Actions>
  );
}

const COLORS: Array<[string, string[]]> = [
  ["Surfaces", ["--bg", "--bg-deep", "--surface", "--surface-2", "--line", "--frame"]],
  ["Text", ["--ink", "--muted", "--on-fire"]],
  ["Theme accent", ["--accent", "--accent-ink", "--accent-soft", "--on-accent", "--focus", "--ring", "--selection"]],
  ["Games (fixed)", ["--fire", "--fire-ink", "--fire-soft", "--on-fire", "--leaf", "--leaf-ink", "--leaf-soft", "--on-leaf", "--gold", "--gold-soft"]],
  ["Games not yet on Switch (VITE_GAMES flag)", ["--ruby", "--ruby-ink", "--ruby-soft", "--on-ruby", "--sapphire", "--sapphire-ink", "--sapphire-soft", "--on-sapphire", "--emerald", "--emerald-ink", "--emerald-soft", "--on-emerald"]],
  ["States", ["--warn", "--warn-soft", "--bad", "--bad-soft", "--cool"]],
];
const TEXT = ["--text-xs", "--text-sm", "--text-md", "--text-lg", "--text-xl", "--text-2xl", "--text-3xl"];
const SPACE = ["--space-1", "--space-2", "--space-3", "--space-4", "--space-5", "--space-6", "--space-8"];
const RADIUS = ["--radius-sm", "--radius-md", "--radius-lg", "--radius-pill"];

const MANY = ["Seed", "Target", "Timer", "Adjust", "Calculator", "Wild", "Egg: appear", "Egg: pick up", "Unown at Tanoby", "Fishing", "Rock Smash", "Surf"];

const SECTIONS = [
  ["principles", "Principles"], ["colors", "Colors"], ["typography", "Typography"], ["space", "Space and shape"], ["icons", "Icons"],
  ["page", "Page and panels"], ["tabs", "Tabs"], ["buttons", "Buttons"], ["fields", "Fields"], ["notices", "Notices and text"],
  ["states", "States"], ["data", "Data"], ["navigation", "Cards and steps"], ["domain", "Domain components"], ["recipe", "Screen recipe"],
] as const;

function useToken(name: string) {
  const [value, setValue] = useState("");
  useEffect(() => {
    const read = () => setValue(getComputedStyle(document.documentElement).getPropertyValue(name).trim());
    read();
    const observer = new MutationObserver(read);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", read);
    return () => { observer.disconnect(); media.removeEventListener("change", read); };
  }, [name]);
  return value;
}

function Swatch({ name }: { name: string }) {
  const value = useToken(name);
  return (
    <div className="ds-swatch">
      <span className="ds-chip" style={{ background: `var(${name})` }} />
      <code>{name}</code>
      <span className="muted mono">{value}</span>
    </div>
  );
}

function TokenRow({ name, children }: { name: string; children: ReactNode }) {
  const value = useToken(name);
  return (
    <div className="ds-token">
      <code>{name}</code>
      <span className="muted mono">{value}</span>
      <div className="ds-token-sample">{children}</div>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={`ds-${id}`} className="ds-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}

function Demo({ name, when, code, children }: { name: string; when: ReactNode; code: string; children: ReactNode }) {
  return (
    <Panel className="ds-demo">
      <div className="ds-demo-head">
        <h3>{name}</h3>
        <p className="muted">{when}</p>
      </div>
      <div className="ds-demo-live">{children}</div>
      <pre className="ds-code"><code>{code.trim()}</code></pre>
    </Panel>
  );
}

// Built by the real services (a test checks that it builds).
export function sampleMon() {
  try {
    return svc.pk3Build({
      fields: { species: 25, level: 12, ot_name: "RED", tid: 12345, sid: 54321, pid: 0x2c5a8e31, ivs: [31, 20, 31, 25, 31, 18], evs: [0, 0, 0, 0, 0, 0], nickname: "PIKA" },
    }).mon;
  } catch {
    return null;
  }
}

function ComboDemo() {
  const [value, setValue] = useState("25");
  const options = [
    { value: "1", label: "Bulbasaur", hint: "#001" }, { value: "4", label: "Charmander", hint: "#004" },
    { value: "7", label: "Squirtle", hint: "#007" }, { value: "25", label: "Pikachu", hint: "#025" }, { value: "277", label: "Treecko", hint: "#252" },
  ];
  return <Fields><Field label="Species"><Combobox value={value} onChange={setValue} options={options} empty="none" placeholder="name or number" /></Field></Fields>;
}

export default function DesignPage() {
  const [tab, setTab] = useState<"a" | "b">("a");
  const [pill, setPill] = useState<"x" | "y" | "z">("x");
  const [many, setMany] = useState("0");
  const [version, setVersion] = useState("firered");
  const [consoleKind, setConsoleKind] = useState("switch1");
  const [radio, setRadio] = useState("wild");
  const [checked, setChecked] = useState(true);
  const [files, setFiles] = useState("");
  const mon = useMemo(sampleMon, []);
  const natures = useMemo(() => rng.meta().natures, []);

  return (
    <Page title="Design system" lead={`Tokens, components and how to build a ${BRAND_NAME} screen. Everything here comes from src/ui; new screens use only these pieces.`}>
      <nav className="ds-toc" aria-label="Catalog sections">
        {SECTIONS.map(([id, label]) => <a key={id} href={`#ds-${id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`ds-${id}`)?.scrollIntoView({ behavior: "smooth" }); }}>{label}</a>)}
      </nav>

      <Section id="principles" title="Principles">
        <Panel>
          <ul className="ds-rules">
            <li><b>Design system pieces only.</b> A new screen imports from <code>src/ui</code>. If a piece is missing, it is born in <code>src/ui</code>, enters this catalog and only then goes to the screen.</li>
            <li><b>Color, space and radius by token.</b> No loose hex in a component: use <code>var(--token)</code>. The tokens already switch in the dark theme.</li>
            <li><b>Space by gap.</b> Panel, Stack, Group and Fields already space their children. Do not put a margin on a child to push a sibling away.</li>
            <li><b>One primary per block.</b> The primary button is the action the person came to do, and it comes first in the action row.</li>
            <li><b>All text through t().</b> Portuguese in the source, English in <code>src/i18n/en</code>. Direct tone, no emoji and no long dashes.</li>
            <li><b>Works at 375 px.</b> Rows wrap on their own; only a table scrolls sideways, inside its own container.</li>
            <li><b>State in shape, not only in color.</b> Tag and Notice have text; the color reinforces it.</li>
          </ul>
        </Panel>
      </Section>

      <Section id="colors" title="Colors">
        <div className="ds-grid">
          {COLORS.map(([group, names]) => (
            <Panel key={group}>
              <h3>{group}</h3>
              {names.map((n) => <Swatch key={n} name={n} />)}
            </Panel>
          ))}
        </div>
        <Note>The accent (<code>--accent</code>) changes with the theme: red in Fire, green in Leaf (button at the top). Components use only the accent; <code>--fire</code> and <code>--leaf</code> are the game colors and never change (version icons, Home gradient). Focus uses the accent: border and ring (<code>--ring</code>) on fields, outline on buttons and links. Leaf, gold, warning and error are states, never decoration; <code>--cool</code> marks the stat the nature lowers. Each strong color has a <code>-soft</code> pair for backgrounds.</Note>
      </Section>

      <Section id="typography" title="Typography">
        <Panel>
          <div className="ds-type">
            <h1>Page title (h1)</h1>
            <h2>Panel title (h2)</h2>
            <h3>Subtitle (h3)</h3>
            <h4>Item title (h4)</h4>
            <p className="lead">Lead: the sentence that opens the page and says what can be done there.</p>
            <p>Running text in the system font, 16 px, line height 1.55. Numbers in tables use equal-width digits.</p>
            <Hint>Hint: explains the block right at its start.</Hint>
            <Note>Note: source, limitation or detail at the end of the block.</Note>
            <p><code>code</code> and <span className="mono">mono (PID 2C5A8E31)</span> for game values.</p>
          </div>
          <p className="muted">Headings use Pixelify Sans (<code>--font-display</code>); text, the system font (<code>--font-body</code>); values, <code>--font-mono</code>.</p>
          {TEXT.map((n) => <TokenRow key={n} name={n}><span style={{ fontSize: `var(${n})` }}>Pikachu</span></TokenRow>)}
        </Panel>
      </Section>

      <Section id="space" title="Space and shape">
        <div className="ds-grid">
          <Panel>
            <h3>Space</h3>
            {SPACE.map((n) => <TokenRow key={n} name={n}><span className="ds-bar" style={{ width: `var(${n})` }} /></TokenRow>)}
          </Panel>
          <Panel>
            <h3>Radius</h3>
            {RADIUS.map((n) => <TokenRow key={n} name={n}><span className="ds-radius" style={{ borderRadius: `var(${n})` }} /></TokenRow>)}
            <h3>Border and shadow</h3>
            <TokenRow name="--border"><span className="ds-radius" style={{ borderWidth: "var(--border)" }} /></TokenRow>
            <TokenRow name="--border-strong"><span className="ds-radius" style={{ borderWidth: "var(--border-strong)" }} /></TokenRow>
            <TokenRow name="--shadow"><span className="ds-radius" style={{ boxShadow: "var(--shadow)" }} /></TokenRow>
          </Panel>
        </div>
      </Section>

      <Section id="icons" title="Icons">
        <Panel>
          <div className="ds-icons">
            {ICON_NAMES.map((name) => <div key={name}><Icon name={name} /><code>{name}</code></div>)}
            <div><Mark /><code>Mark</code></div>
          </div>
          <Note>Own drawings on a 24 px grid, 2 px stroke, color from <code>currentColor</code>. No sprites, logos or official art. A new icon goes in <code>src/ui/Icon.tsx</code>.</Note>
        </Panel>
      </Section>

      <Section id="page" title="Page and panels">
        <Demo name="Page, PageHeader" when="Page on every screen: sets the tab title and shows the header (h1 and lead). heading replaces the h1; header={false} hides the header. PageHeader alone only when the header sits inside another block (the Home hero)."
          code={`<Page title={t("Códigos")} heading={t("Códigos da comunidade")} lead={t("...")}>\n  ...\n</Page>`}>
          <PageHeader eyebrow="optional eyebrow" title="Community codes" lead="Paste a code's box names here." />
        </Demo>
        <Demo name="Panel, PanelSection, PanelForm" when="A screen block. PanelForm is a panel that submits on Enter (it already calls preventDefault). variant plain: a block inside another panel, without a frame; prose: Markdown text."
          code={`<PanelForm onSubmit={check}>\n  <h2>{t("Seu jogo")}</h2>\n  <Fields>...</Fields>\n  <Actions><Button variant="primary" type="submit">...</Button></Actions>\n</PanelForm>`}>
          <Panel>
            <h2>Panel</h2>
            <p>Double frame, like a GBA dialog box. Children sit 14 px apart.</p>
            <Panel variant="plain"><p className="muted">variant="plain": the grouping without the frame.</p></Panel>
          </Panel>
        </Demo>
        <Demo name="Stack" when="Column of blocks with the same spacing (results, list of cards). gap sm for related blocks."
          code={`<Stack>\n  {error && <Notice tone="error">{error}</Notice>}\n  {result && <MonCard ... />}\n</Stack>`}>
          <Stack gap="sm"><Notice>First block</Notice><Notice tone="tip">Second block</Notice></Stack>
        </Demo>
        <Demo name="Group" when="Section of a large form (editor). collapsible for what is optional."
          code={`<Group title={t("Golpes")}>\n  <Fields>...</Fields>\n</Group>\n<Group title={t("Item, origem e outros")} collapsible>...</Group>`}>
          <Group title="Trainer">
            <Fields><Field label="OT name"><input defaultValue="RED" /></Field><Field label="TID"><NumberInput min={0} defaultValue={12345} /></Field></Fields>
          </Group>
          <Group title="Item, origin and more" collapsible><Note>Collapsed content.</Note></Group>
        </Demo>
        <Demo name="Details" when="Help that need not always show (where the file comes from, how the keyboard works)."
          code={`<Details summary={t("De onde vem o arquivo")}>\n  <ul>...</ul>\n</Details>`}>
          <Details summary="Where the file comes from"><ul><li>PKHeX exports .pk3.</li></ul></Details>
        </Demo>
      </Section>

      <Section id="tabs" title="Tabs">
        <Demo name="Tabs folder + TabPanel" when="Switches screen sections (Open, Create, Put in game). The tab touches the card right below. TabPanel keeps the tab mounted so typed input is not lost. The first child of each TabPanel is a Panel: the active tab fits into it."
          code={`<Stack>\n  <Tabs tabs={tabs} value={tab} onChange={setTab} label="Pokémon" />\n  <TabPanel active={tab === "read"}><ReadTab /></TabPanel>\n</Stack>`}>
          <Stack>
            <Tabs tabs={[{ id: "a", label: "Open" }, { id: "b", label: "Create or edit" }]} value={tab} onChange={setTab} label="Example" />
            <TabPanel active={tab === "a"}><Panel><p>Content of the Open tab.</p></Panel></TabPanel>
            <TabPanel active={tab === "b"}><Panel><p>Content of the Create or edit tab.</p></Panel></TabPanel>
          </Stack>
        </Demo>
        <Demo name="Tabs folder with many tabs" when="When the tabs are wider than the card, the bar scrolls sideways (drag, mouse wheel or arrow keys) and the active tab scrolls into view on its own."
          code={`<Tabs tabs={manyTabs} value={tab} onChange={setTab} label="Steps" />`}>
          <Stack>
            <Tabs tabs={MANY.map((label, i) => ({ id: String(i), label: <><span className="n">{i + 1}</span> {label}</> }))} value={many} onChange={setMany} label="Many tabs" />
            <Panel><p>Content of the {MANY[Number(many)]} tab.</p></Panel>
          </Stack>
        </Demo>
        <Demo name="Tabs pills" when="Mode choice inside a card (encounter type)."
          code={`<Tabs variant="pills" tabs={tabs} value={kind} onChange={setKind} label={t("Tipo de encontro")} />`}>
          <Tabs variant="pills" tabs={[{ id: "x", label: "Static" }, { id: "y", label: "Wild" }, { id: "z", label: "Egg" }]} value={pill} onChange={setPill} label="Example" />
        </Demo>
      </Section>

      <Section id="buttons" title="Buttons">
        <Demo name="Button, ButtonLink" when="primary: the block's main action (only one). default: the rest. sm: actions inside a table or card; lg: the timer button. ButtonLink navigates to another screen. type is button by default; a form submit asks for type=&quot;submit&quot;."
          code={`<Button variant="primary" type="submit">{t("Buscar")}</Button>\n<Button size="sm" onClick={...}>{t("Usar")}</Button>\n<ButtonLink to="/rng">{t("Caçar com RNG")}</ButtonLink>`}>
          <Actions>
            <Button variant="primary">Primary</Button>
            <Button>Default</Button>
            <Button size="sm">Small</Button>
            <Button size="sm" variant="primary">Small primary</Button>
            <Button disabled>Disabled</Button>
            <ButtonLink to="/design">Link</ButtonLink>
          </Actions>
          <Actions><Button variant="primary" size="lg">Start</Button></Actions>
        </Demo>
        <Demo name="Actions" when="Row of buttons. Inside Fields, it aligns to the fields' baseline."
          code={`<Actions>\n  <Button variant="primary" type="submit">{t("Conferir")}</Button>\n  <Button onClick={clear}>{t("Limpar")}</Button>\n</Actions>`}>
          <Actions><Button variant="primary">Check</Button><Button>Clear</Button></Actions>
        </Demo>
      </Section>

      <Section id="fields" title="Fields">
        <Demo name="Fields, Field" when="Row of fields that wraps on its own. width: normal (up to 280 px), wide (long lists, up to 460 px), full (textarea)."
          code={`<Fields>\n  <Field label={t("Espécie")} width="wide"><select>...</select></Field>\n  <Field label="TID"><NumberInput /></Field>\n  <Actions><Button type="submit">...</Button></Actions>\n</Fields>`}>
          <Fields>
            <Field label="Species" width="wide"><select defaultValue="25"><option value="25">025 Pikachu</option><option value="1">001 Bulbasaur</option></select></Field>
            <Field label="Level"><NumberInput defaultValue={12} min={1} max={100} /></Field>
            <Field label="Initial seed (hex)"><input className="mono" defaultValue="11C7" /></Field>
            <Actions><Button variant="primary">Search</Button></Actions>
          </Fields>
          <Fields><Field label="Bytes in hexadecimal" width="full"><textarea className="mono" rows={2} placeholder="78 56 34 12 ..." /></Field></Fields>
        </Demo>
        <Demo name="Check, Radios" when="Check: turns something on or off. Radios: single choice among a few options that need explanation; with many, use select."
          code={`<Check label={t("Som")} checked={sound} onChange={(e) => setSound(e.target.checked)} />\n<Radios legend={t("Como o Pokémon nasce")} name="strategy" value={v} onChange={setV} options={[...]} />`}>
          <Fields>
            <Check label="Switch version" checked={checked} onChange={(e) => setChecked(e.target.checked)} />
            <Radios legend="How the Pokémon is born" name="ds-radio" value={radio} onChange={setRadio}
              options={[{ value: "wild", label: "In a wild battle" }, { value: "egg", label: "In an egg with the right PID" }]} />
          </Fields>
        </Demo>
        <Demo name="NumberInput" when="Every number field. Drops letters while the person types (type=number lets them through in Firefox and Safari); negative only without min or with min below zero; decimals with the decimal prop. The code reading the value checks the range (min and max)."
          code={`<Field label={t("Nível")}><NumberInput min={1} max={100} value={level} onChange={(e) => setLevel(e.target.value)} /></Field>`}>
          <Fields>
            <Field label="Level"><NumberInput min={1} max={100} defaultValue="50" /></Field>
            <Field label="Offset (ms)"><NumberInput defaultValue="-1680" /></Field>
            <Field label="Around (seconds)"><NumberInput decimal min={0} defaultValue="35,5" /></Field>
          </Fields>
        </Demo>
        <Demo name="Combobox" when="Choose among many options (species, moves). Typing filters by name, ignoring accents and case, or by the hint number; arrows move, Enter picks, Esc reverts. empty adds the empty option. For a few options, use select."
          code={`<Combobox value={species} onChange={setSpecies} options={speciesChoices(meta.species)} empty={t("nenhuma")} placeholder={t("nome ou número")} />`}>
          <ComboDemo />
        </Demo>
        <Demo name="Segmented" when="Single choice among 2 to 4 short options that fit in view (game version, console). It may have an icon, in the theme accent or in a fixed game color (tone fire or leaf: game versions keep their color in any theme). With more options or long texts, use select; with options that need explanation, Radios."
          code={`<Segmented label={t("Versão")} name="version" value={version} onChange={setVersion} options={[\n  { value: "firered", label: "FireRed", icon: "flame", tone: "fire" },\n  { value: "leafgreen", label: "LeafGreen", icon: "leaf" },\n]} />`}>
          <Fields>
            <Segmented label="Version" name="ds-version" value={version} onChange={setVersion}
              options={[{ value: "firered", label: "FireRed", icon: "flame", tone: "fire" }, { value: "leafgreen", label: "LeafGreen", icon: "leaf", tone: "leaf" }]} />
            <Segmented label="Console" name="ds-console" value={consoleKind} onChange={setConsoleKind}
              options={[{ value: "switch1", label: "Switch" }, { value: "switch2", label: "Switch 2" }]} />
          </Fields>
        </Demo>
        <Demo name="FileDrop" when="Open files from the computer. The file never leaves the browser."
          code={`<FileDrop title={t("Escolha ou arraste")} detail={t("arquivos .pk3")} hint={t("O arquivo fica no seu computador.")}\n  accept=".pk3,.ek3" multiple onFiles={readFiles} />`}>
          <FileDrop title="Choose or drop" detail=".pk3 or .ek3 files" hint="The file stays on your computer." multiple
            onFiles={(list) => setFiles(list.map((f) => `${f.name} (${f.size} bytes)`).join(", "))} />
          {files && <Note>{files}</Note>}
        </Demo>
      </Section>

      <Section id="notices" title="Notices and text">
        <Demo name="Notice" when="note: information; tip: success or a hint; warn: careful with the save; error: something failed (announced to screen readers). Guide Markdown uses the same look (:::note, :::tip, :::warn)."
          code={`<Notice tone="warn" title={t("Salve antes de disparar.")}>{t("...")}</Notice>\n<Notice tone="error">{error}</Notice>`}>
          <Stack gap="sm">
            <Notice>Open a file in the Open tab or create a Pokémon.</Notice>
            <Notice tone="tip">Timer corrected: step 1 +16 ms. <Button size="sm">Go to the timer</Button></Notice>
            <Notice tone="warn" title="Save before triggering.">Leave Box 13 empty from slot 7 on.</Notice>
            <Notice tone="error">bulba.ek3: the checksum does not match.</Notice>
          </Stack>
        </Demo>
        <Demo name="Prereq" when="What is missing before a step: always at the top of the screen, before the content, with one button per item to go do it. Disappears when nothing is missing."
          code={`<Prereq items={[{ text: t("Escolher uma seed na etapa 1 (Seed)."), action: <Button size="sm" onClick={() => setStep("seed")}>{t("Ir para a etapa 1")}</Button> }]} />`}>
          <Prereq items={[
            { text: "Pick a seed in step 1 (Seed).", action: <Button size="sm">Go to step 1</Button> },
            { text: "Pick the target in step 2 (Target): click Aim on a result.", action: <Button size="sm">Go to step 2</Button> },
          ]} />
        </Demo>
        <Demo name="Term, TermTips" when="A term newcomers may not know. Mouse: hover; touch or Enter: pins the tip; Esc or tapping outside closes it. TermTips is mounted once in the layout and reads the glossary (src/content/glossary). In the guides, the first occurrence of each term becomes a tip on its own."
          code={`<p>With <Term k="ace">ACE</Term> unlocked, the <Term k="writer">Base64 writer</Term> creates any Pokémon.</p>`}>
          <p>With <Term k="ace">ACE</Term> unlocked, the <Term k="writer">Base64 writer</Term> creates any Pokémon from a <Term k="pid">PID</Term>.</p>
        </Demo>
        <Demo name="Hint, Note" when="Hint opens the block explaining what it does. Note closes it with a source or limitation; items makes it a list; inline sits next to a button."
          code={`<Hint>{t("A seed depende de ...")}</Hint>\n<Note>{t("Tempos da planilha ...")}</Note>\n<Note items={[t("..."), t("...")]} />`}>
          <Hint>The seed depends on how long it takes you to press the button on the title screen.</Hint>
          <Note>Times from the community's public spreadsheet used by ten-lines.</Note>
          <Note items={["Use wired audio.", "The offsets are filled in on their own."]} />
        </Demo>
        <Demo name="Key, InGame" when="Key: a controller button name inside text (A, B, START, L); in translated text, with tx (src/i18n/rich.tsx) and the button in a field, never a bare letter. InGame: game screen text (OPTION, SOUND, CONTINUE); tx highlights the GAME_WORDS words on its own. Not for buttons and field labels."
          code={`<p>{tx("Na tela de título, aperte {button} no último bipe.", { button: <Key>A</Key> })}</p>\n<Hint>{tx("O jogo só lê SOUND e BUTTON MODE do menu OPTION.")}</Hint>`}>
          <p>On the title screen, press <Key>A</Key> on the last beep. The replay can be skipped with <Key>B</Key>.</p>
          <p>The game only reads <InGame>SOUND</InGame> and <InGame>BUTTON MODE</InGame> from the <InGame>OPTION</InGame> menu, before <InGame>CONTINUE</InGame>.</p>
        </Demo>
      </Section>

      <Section id="states" title="States">
        <Demo name="Tag" when="Status of something: ok (valid, ready), warn (under construction, warning), bad (error), shiny."
          code={`<Tag tone={errors ? "bad" : "ok"}>{errors ? t("{n} erro(s)", { n: errors }) : t("válido")}</Tag>`}>
          <Actions><Tag>valid</Tag><Tag tone="warn">under construction</Tag><Tag tone="bad">2 error(s)</Tag><Tag tone="shiny">shiny</Tag></Actions>
        </Demo>
        <Demo name="TypeBadge" when="Pokémon type (including Hidden Power's): the type color as in the games, uppercase name in the pixel font. Names follow FR/LG (FIGHT, ELECTR, PSYCHC)."
          code={`<TypeBadge type="FIRE" />`}>
          <Actions>{Object.keys(TYPE_COLORS).filter((k) => !["FIGHTING", "ELECTRIC", "PSYCHIC"].includes(k)).map((k) => <TypeBadge key={k} type={k} />)}</Actions>
        </Demo>
        <Demo name="MonIcon" when="Pokémon icon (party and box) before the name, by game id: frame 0 (the top one in the FR/LG decomp), sheet generated by tools/gen_mon_sprites.py. In the species Combobox options (speciesChoices), it goes in icon."
          code={`<MonIcon species={283} />`}>
          <Actions>{[1, 4, 7, 25, 133, 151, 152, 201, 277, 280, 283, 308, 410].map((id) => <MonIcon key={id} species={id} />)}</Actions>
        </Demo>
        <Demo name="ItemIcon, Item" when="Game item icon before the name (Poké Balls, Rare Candy, berries, TMs), by game id. Item keeps icon and name on one line; with text, it gets the InGame highlight (a name quoted in running text). In Combobox options, it goes in icon. tx and the guides add the icon before ITEM_WORDS names on their own (src/i18n/gameWords.ts). Drawings from PokéSprite, sheet generated by tools/gen_sprites.py."
          code={`<Item id={info.ball.id}>{pretty(info.ball.name)}</Item>`}>
          <Actions>{[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((id) => <ItemIcon key={id} id={id} />)}</Actions>
          <p><Item id={68}>Rare Candy</Item>, <Item id={139}>Oran Berry</Item>, <Item id={289}>TM01</Item>, <Item id={350}>Poké Flute</Item></p>
          <p>In running text (text): level up with <Item id={68} text>Rare Candy</Item> and hold an <Item id={195} text>Everstone</Item>.</p>
        </Demo>
        <Demo name="RibbonIcon, RibbonList" when="Gen 3 ribbon with the game icon: single-bit ones by name (champion), contest ones with the rank (1, Normal, to 4, Master), as in lib/gen3/ribbons.ts. off dims one the Pokémon lacks, next to a field. RibbonList shows the ones it has, side by side. Drawings from PokéSprite, sheet generated by tools/gen_sprites.py."
          code={`<RibbonList ribbons={[{ ribbon: "cool", rank: 4, name: "Cool Master" }, { ribbon: "champion", name: "Champion" }]} />`}>
          <Actions>{["cool", "beauty", "cute", "smart", "tough"].flatMap((k) => [1, 2, 3, 4].map((r) => <RibbonIcon key={k + r} ribbon={k} rank={r} />))}</Actions>
          <Actions>{["champion", "winning", "victory", "artist", "effort", "marine", "land", "sky", "country", "national", "earth", "world"].map((k) => <RibbonIcon key={k} ribbon={k} />)}<RibbonIcon ribbon="effort" off /></Actions>
          <RibbonList ribbons={[{ ribbon: "cool", rank: 4, name: "Cool Master" }, { ribbon: "champion", name: "Champion" }]} />
        </Demo>
        <Demo name="MenuButton" when="Icon button that opens a list to pick one option, when there are more options than a toggle button fits (the game theme at the top with more than two games enabled). Arrows move, Enter picks, Esc closes."
          code={`<MenuButton label={t("Tema do jogo")} value={accent} onChange={setAccent} options={games}><Icon name="flame" /></MenuButton>`}>
          <MenuDemo />
        </Demo>
        <Demo name="GenderChoice" when="Pokémon or trainer gender as a visible choice, with the symbol before the name. Single-gender or genderless species: only the valid option, locked (disabled)."
          code={`<GenderChoice label={t("Gênero")} value={gender} onChange={setGender} options={[{ value: "", label: t("qualquer"), gender: null }, { value: "M", label: t("macho"), gender: "M" }, { value: "F", label: t("fêmea"), gender: "F" }]} />`}>
          <GenderDemo />
        </Demo>
        <Demo name="Flag" when="Flag of the Pokémon's language (the game's LANGUAGE_*), own drawing. With children, keeps flag and name on one line; in Combobox options, it goes in icon."
          code={`<Flag language={info.language.id}>{info.language.name}</Flag>`}>
          <Actions>{[[1, "Japanese"], [2, "English"], [3, "French"], [4, "Italian"], [5, "German"], [7, "Spanish"]].map(([id, name]) => <Flag key={id} language={id as number}>{name}</Flag>)}</Actions>
        </Demo>
        <Demo name="StatChange" when="A nature's effect: the stat it raises (red, as on the card) and the one it lowers (blue), with arrows; when both are the same, neutral. In Combobox options, it goes in detail."
          code={`<StatChange up="Atk" down="SpA" />`}>
          <Actions><StatChange up="Atk" down="SpA" /><StatChange up="Spe" down="Def" /><StatChange up="Atk" down="Atk" /></Actions>
        </Demo>
        <Demo name="MoveCategoryIcon, MoveLabel" when="Move category (physical, special, status), own drawing in the games' style. In Gen 3 it comes from the type (species.moveCategory). MoveLabel joins category, name and the type on the right; in the Combobox, the category goes in icon and the type in detail (moveOption)."
          code={`<MoveLabel category={species.moveCategory(id)} type={species.moveTypeName(id)}>{name}</MoveLabel>`}>
          <Actions><MoveCategoryIcon category="physical" /><MoveCategoryIcon category="special" /><MoveCategoryIcon category="status" /></Actions>
          <div style={{ maxWidth: 320 }}>
            <MoveLabel category="physical" type="GROUND">Earthquake</MoveLabel>
            <MoveLabel category="special" type="FIRE">Flamethrower</MoveLabel>
            <MoveLabel category="status" type="NORMAL">Swords Dance</MoveLabel>
          </div>
        </Demo>
        <Demo name="Dialog" when="Window over the page, with the native <dialog>: focus trapped inside, Esc or a click outside closes it. For content that needs room and returns to the field it came from, like the region map."
          code={`<Dialog open={open} onClose={() => setOpen(false)} title="Region map">...</Dialog>`}>
          <DialogDemo />
        </Demo>
        <Demo name="TypingGuide" when="The game's box naming screen (components/NamingScreen) with each letter's path on the controller. Next letter shows the cursor moving along the path. PcBoxTitle shows the top of the PC box with the name."
          code={`<TypingGuide box={1} name={box.name} steps={box.steps} onDone={...} />\n<PcBoxTitle number={1} name="FM.oZ.Bn" />`}>
          <Stack gap="sm">
            <div style={{ maxWidth: 260 }}><PcBoxTitle number={1} name="FM.oZ.Bn" /></div>
            <TypingGuide box={1} name="FM.oZ.Bn" steps={typingSteps("FM.oZ.Bn")} />
          </Stack>
        </Demo>
        <Demo name="MailGlitch" when="Glitched Mail screens in the ACE guide (components/MailGlitch), placed in Markdown with :::screen mail-glitch."
          code={`:::screen mail-glitch`}>
          <MailGlitch />
        </Demo>
        <Demo name="Gender" when="Pokémon gender as in game: blue ♂, pink ♀, a dash when genderless. Screen readers hear the name."
          code={`<Gender value={row.gender} />`}>
          <Actions><Gender value="M" /><Gender value="F" /><Gender value="-" /></Actions>
        </Demo>
        <Demo name="Chip, Chips" when="Stateless information (what a guide requires, its level)."
          code={`<Chips><Chip><b>{t("precisa de ")}</b>{needs}</Chip><Chip>{level}</Chip></Chips>`}>
          <Chips><Chip><b>requires </b>ACE unlocked</Chip><Chip>intermediate</Chip></Chips>
        </Demo>
        <Demo name="Progress" when="Long task with a known end (RNG search, timer). Value from 0 to 1."
          code={`<Progress value={done / total} label={t("Busca")} />`}>
          <Progress value={0.62} label="Example" />
        </Demo>
        <Demo name="OptionCard, OptionChip" when="Choosing among options with details (the Pokémon of an area): the card picks, the buttons below refine (level, letter). OptionChip without onClick only displays."
          code={`<OptionCard selected={on} onSelect={pick} title="Pidgey" aside="50%" meta={<TypeBadge type="Normal" />}>\n  <OptionChip selected={lv === 3} onClick={...}>Lv. 3</OptionChip>\n</OptionCard>`}>
          <OptionCardDemo />
        </Demo>
        <Demo name="EmptyState" when="Nothing found (a search without results, a page that does not exist): Red, or Leaf in the Leaf theme, walking along a strip, with the text below and, when it makes sense, buttons."
          code={`<EmptyState actions={<ButtonLink to="/">Home</ButtonLink>}>Nothing passed the filters.</EmptyState>`}>
          <EmptyState actions={<Button size="sm">Loosen the filters</Button>}>No frame advance passed the filters.</EmptyState>
        </Demo>
        <Demo name="ClientOnly" when="Part of the screen that only exists in the browser (the tools, which depend on stored data and are heavy). The prerendered page and hydration show a placeholder with the given height; then the content (with Suspense, for lazy). useHydrated says whether hydration is over, for code that reads the browser while rendering."
          code={`const Tool = lazy(() => import("./rng/RngPage"));\n<ClientOnly><Tool /></ClientOnly>`}>
          <ClientOnly minHeight="48px"><p>Content that only exists in the browser.</p></ClientOnly>
        </Demo>
        <Demo name="SearchProgress" when="RNG search: the capture Poké Ball wobbles beside the bar while it runs and stops when it ends. For timers, use Progress."
          code={`<SearchProgress value={done / total} label={t("Busca")} running={busy} />`}>
          <Stack gap="sm">
            <SearchProgress value={0.4} label="Searching" running />
            <SearchProgress value={1} label="Done" running={false} />
          </Stack>
        </Demo>
        <Demo name="Tour" when="Interactive guide with Professor Oak over the screen: dims the page, highlights the element marked with tour (data-tour) and explains in the game's dialog box. The real tours come from content/tours and open from TourStart; here, two steps about this demo."
          code={`<Tour step={{ target: "rng-seed-list", html }} index={0} total={9} title="First seed"\n  onNext={next} onBack={back} onExit={exit} />`}>
          <TourDemo />
        </Demo>
        <Demo name="FlyingMew" when="Mounted once in Layout: the Faraway Island Mew shows up now and then, crosses the screen from one edge and leaves through another, without catching clicks. summonMew() summons it right away."
          code={`<FlyingMew />   // in Layout\nsummonMew();   // summon now`}>
          <Button size="sm" onClick={summonMew}>Summon Mew</Button>
        </Demo>
        <Demo name="IssueList, IssueLegend" when="IssueLegend, below the list, explains the tags that appear. Items of a validation, one per line: error and warning (problems, as the services return them), note (information only) and choice (what the site decided on its own while building)."
          code={`<IssueList issues={info.issues} />`}>
          <IssueList issues={[{ level: "error", field: "checksum", message: "stored 1A2B, computed 3C4D" }, { level: "warning", message: "move the species does not learn" },
            { level: "note", field: "met_level", message: "hatched from an egg (met level 0)" }, { level: "choice", message: "random PID: 1BB18A3B (Mild)" }]} />
          <IssueLegend levels={["error", "warning", "note", "choice"]} />
        </Demo>
      </Section>

      <Section id="data" title="Data">
        <Demo name="KV" when="Label and value pairs (a Pokémon's sheet). null or false rows are skipped."
          code={`<KV rows={[[t("Espécie"), name], info.gender ? [t("Gênero"), g] : null]} />`}>
          <KV rows={[["Species", "#025 Pikachu"], ["PID", <span className="mono">2C5A8E31</span>], ["Nature", "Timid"]]} />
        </Demo>
        <Demo name="Table, TableWrap" when="grid: lists (seeds, boxes, parameters). stat: compact numbers. Rows with row-chosen, row-found and row-bad mark state. A table built elsewhere goes in TableWrap."
          code={`<Table>\n  <thead><tr><th>seed</th><th>{t("apertar aos")}</th></tr></thead>\n  <tbody>...</tbody>\n</Table>`}>
          <Table>
            <thead><tr><th>seed</th><th>press at</th><th></th></tr></thead>
            <tbody>
              <tr><td className="mono">11C7</td><td>35.012 s</td><td><Button size="sm">Use</Button></td></tr>
              <tr className="row-chosen"><td className="mono">5A0E</td><td>35.029 s</td><td><Tag>chosen</Tag></td></tr>
              <tr className="row-found"><td className="mono">E2F1</td><td>35.045 s</td><td /></tr>
              <tr className="row-bad"><td className="mono">0000</td><td>35.062 s</td><td /></tr>
            </tbody>
          </Table>
          <Table variant="stat">
            <thead><tr><th></th><th>base</th><th>IV</th><th>EV</th></tr></thead>
            <tbody><tr><td>HP</td><td>35</td><td>31</td><td>0</td></tr><tr><td>Atk</td><td>55</td><td>20</td><td>0</td></tr></tbody>
          </Table>
        </Demo>
      </Section>

      <Section id="navigation" title="Cards and steps">
        <Demo name="CardGrid, LinkCard" when="Shortcuts to other screens (Home, guide index). The whole card is the link."
          code={`<CardGrid>\n  <LinkCard to="/rng"><Icon name="dice" className="card-icon" /><h2>RNG</h2><p>...</p></LinkCard>\n</CardGrid>`}>
          <CardGrid>
            <LinkCard to="/design"><Icon name="dice" className="card-icon" /><h3>RNG</h3><p>Find the moment the shiny appears.</p></LinkCard>
            <LinkCard to="/design"><Icon name="box" className="card-icon" /><h3>Codes</h3><p>Check the box names before typing.</p></LinkCard>
          </CardGrid>
        </Demo>
        <Demo name="Steps" when="Ordered instructions. Markdown numbered lists use the same look."
          code={`<Steps>\n  <li>{t("Tenha a ACE liberada.")}</li>\n  <li>...</li>\n</Steps>`}>
          <Steps><li>Have ACE unlocked on your save.</li><li>Paste the names as they came.</li><li>Type box by box.</li></Steps>
        </Demo>
      </Section>

      <Section id="domain" title="Domain components">
        <p className="muted">They live in <code>src/components</code>: built from the pieces above, and they know how to read game data.</p>
        <Demo name="MonCard" when="Full sheet of a Gen 3 Pokémon (pk3Inspect or pk3Build). actions takes the context's button row."
          code={`<MonCard label={file.name} info={info} natures={meta.natures} actions={<Actions>...</Actions>} />`}>
          {mon ? <MonCard label="example.pk3" info={mon} natures={natures} actions={<Actions><Button size="sm">Edit</Button><Button size="sm" variant="primary">Put in game</Button></Actions>} />
            : <Notice tone="error">Could not build the sample.</Notice>}
        </Demo>
      </Section>

      <Section id="recipe" title="Screen recipe">
        <Panel>
          <p>Every screen follows the same order. Copy the skeleton and swap the content.</p>
          <Steps>
            <li><b>Page</b> with a title and lead: what the person does here, in one sentence.</li>
            <li><b>Notice warn</b> if the screen touches the save (always with a link to the safety guide).</li>
            <li><b>Tabs</b> if the screen has sections; each one in a <b>TabPanel</b>.</li>
            <li><b>PanelForm</b> with Hint, Fields and Actions (primary first).</li>
            <li><b>Stack</b> of results: Notice error, then the result.</li>
            <li><b>Details</b> with the help and <b>Note</b> with sources and limitations.</li>
          </Steps>
          <pre className="ds-code"><code>{`export function ExamplePage() {
  const [value, setValue] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState("");
  return (
    <Page title={t("Exemplo")} lead={t("O que dá para fazer aqui, numa frase.")}>
      <Notice tone="warn" title={t("Salve antes.")}>
        {t("...")} <Link to="/guides/safety">{t("Proteja o seu save")}</Link>.
      </Notice>
      <PanelForm onSubmit={() => run(value)}>
        <Hint>{t("O que este bloco faz.")}</Hint>
        <Fields>
          <Field label={t("Valor")}><input value={value} onChange={(e) => setValue(e.target.value)} /></Field>
        </Fields>
        <Actions><Button variant="primary" type="submit">{t("Calcular")}</Button></Actions>
      </PanelForm>
      <Stack>
        {error && <Notice tone="error">{error}</Notice>}
        {result && <Panel>...</Panel>}
      </Stack>
      <Details summary={t("Como funciona")}><ul>...</ul></Details>
    </Page>
  );
}`}</code></pre>
        </Panel>
      </Section>
    </Page>
  );
}

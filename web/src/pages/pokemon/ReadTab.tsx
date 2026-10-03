// Open tab: .pk3/.ek3 files or pasted bytes. Switch game files (pk8, pb8, pa8) only get a warning.

import { useState, type ReactNode } from "react";
import { t } from "../../i18n";
import { Actions, Button, Details, Field, FileDrop, Notice, Panel, Stack } from "../../ui";
import { MonCard } from "../../components/MonCard";
import { bytesToHex, num } from "../../components/format";
import * as svc from "../../lib/services/pokemon";
import * as rng from "../../lib/services/rng";
import { usePokemon } from "./store";

// Stored and party sizes of pk8/pb8 (0x148, 0x158) and pa8 (0x168, 0x178).
const SWITCH_SIZES = [0x148, 0x158, 0x168, 0x178];
const SWITCH_EXTENSIONS = ["pk8", "pb8", "pa8"];

function isSwitchFile(name: string, size: number): boolean {
  const ext = name.match(/\.([a-z0-9]+)$/i)?.[1]?.toLowerCase();
  return (ext !== undefined && SWITCH_EXTENSIONS.includes(ext)) || SWITCH_SIZES.includes(size);
}

function MonActions({ label, info }: { label: string; info: svc.Pk3Description }) {
  const { edit, send } = usePokemon();
  if (!info.files) return null;
  return (
    <Actions>
      <Button size="sm" onClick={() => edit({ label, info })}>{t("Editar")}</Button>
      <Button size="sm" variant="primary" onClick={() => send({ label, info })}>{t("Colocar no jogo")}</Button>
    </Actions>
  );
}

export function inspect(label: string, hex: string): ReactNode {
  const natures = rng.meta().natures;
  if (isSwitchFile(label, hex.length / 2)) {
    return <Notice key={label} tone="warn">{t("{name}: Pokémon de um jogo de Switch (pk8, pb8 ou pa8). O site é da Gen 3 e abre só .pk3 e .ek3.", { name: label })}</Notice>;
  }
  try {
    const info = svc.pk3Inspect({ hex });
    return <MonCard key={label} label={label} info={info} natures={natures} actions={<MonActions label={label} info={info} />} />;
  } catch (e) {
    return <Notice key={label} tone="error">{`${label}: ${(e as Error).message}`}</Notice>;
  }
}

export function ReadTab() {
  const [cards, setCards] = useState<ReactNode[]>([]);
  const [hex, setHex] = useState("");

  const readFiles = async (files: File[]) => {
    const out: ReactNode[] = [];
    for (const file of files) {
      if (file.size > 4096) {
        out.push(<Notice key={file.name} tone="error">{t("{name}: {size} bytes, grande demais para um Pokémon", { name: file.name, size: num(file.size) })}</Notice>);
        continue;
      }
      const bytes = new Uint8Array(await file.arrayBuffer());
      out.push(inspect(file.name, bytesToHex(bytes)));
    }
    setCards(out);
  };

  return (
    <>
      <Panel className="pk3-input">
        <FileDrop title={t("Escolha ou arraste")} detail={t("arquivos .pk3 ou .ek3")} hint={t("O arquivo fica no seu computador.")}
          accept=".pk3,.ek3,.bin,application/octet-stream" multiple onFiles={(files) => void readFiles(files)} />
        <form className="hex-form" autoComplete="off" onSubmit={(e) => {
          e.preventDefault();
          setCards([inspect(t("bytes colados"), hex.replace(/0x/gi, "").replace(/[\s,]/g, ""))]);
        }}>
          <Field label={t("Ou cole os bytes em hexadecimal")} width="full">
            <textarea className="mono" rows={4} spellCheck={false} placeholder="78 56 34 12 39 30 31 D4 ..." value={hex} onChange={(e) => setHex(e.target.value)} />
          </Field>
          <Button variant="primary" type="submit">{t("Abrir")}</Button>
        </form>
      </Panel>
      {cards.length > 0 && <Stack>{cards}</Stack>}
      <Details summary={t("De onde vem o arquivo")}>
        <ul>
          <li>{t("O PKHeX e outros editores de save exportam .pk3. No Switch, o save fica dentro do console e só sai com ele desbloqueado.")}</li>
          <li>{t("Com a placa ESP32, você vai poder mandar um Pokémon por troca e o PC salva o arquivo (em construção).")}</li>
        </ul>
      </Details>
    </>
  );
}

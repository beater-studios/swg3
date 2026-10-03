// "Map" button next to a location field: picks from the region map (TownMap) in a dialog.

import { useState } from "react";
import { t } from "../i18n";
import { Button, Dialog, Icon } from "../ui";
import { TownMap, type TownMapChoice, type TownMapGame } from "./TownMap";

export function TownMapPicker({ games, game, value, choices, marked, onPick, title }: {
  games?: TownMapGame[];
  game?: number | null;
  value: number | null;
  choices: (section: number, games: TownMapGame) => TownMapChoice[];
  marked?: ReadonlySet<number>;
  onPick: (value: string) => void;
  title?: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button className="btn-icon" onClick={() => setOpen(true)} aria-label={t("Ver no mapa")} title={t("Ver no mapa")}><Icon name="map" /></Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={title ?? t("Mapa da região")} className="townmap-dialog" bare>
        <TownMap games={games} game={game} value={value} choices={choices} marked={marked} onClose={() => setOpen(false)} onPick={(v) => { onPick(v); setOpen(false); }} />
      </Dialog>
    </>
  );
}

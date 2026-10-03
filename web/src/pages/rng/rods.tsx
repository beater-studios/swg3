// Fishing rods for the fishing area, with the item icon (ids in include/constants/items.h).

import { Item, type SegmentOption } from "../../ui";
import type { Rod } from "../../lib/gen3/wild";

export type { Rod };

export const RODS: SegmentOption<Rod>[] = [
  { value: "old", label: <Item id={262}>Old Rod</Item> },
  { value: "good", label: <Item id={263}>Good Rod</Item> },
  { value: "super", label: <Item id={264}>Super Rod</Item> },
];

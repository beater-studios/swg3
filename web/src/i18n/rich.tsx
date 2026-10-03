// Translation with React elements in place of fields, e.g. tx(<key with {button}>, { button: <Key>A</Key> }).

import { Fragment, type ReactNode } from "react";
import { InGame, Item, Key } from "../ui";
import { t } from "./index";
import { GAME_WORDS, ITEM_WORDS, isItemWord, wordsPattern } from "./gameWords";

export { GAME_WORDS };

/** Buttons (A, B, L) only via `keys`, since a lone letter would be confused with common words. */
export function highlight(text: string, keys: readonly string[] = []): ReactNode {
  const parts = text.split(wordsPattern(keys));
  if (parts.length === 1) return text;
  return parts.map((part, i) => (i % 2 === 0 ? part
    : <Fragment key={i}>{keys.includes(part) ? <Key>{part}</Key> : isItemWord(part) ? <Item id={ITEM_WORDS[part]} text>{part}</Item> : <InGame>{part}</InGame>}</Fragment>));
}

export function tx(text: string, vars: Record<string, ReactNode> = {}): ReactNode {
  return t(text).split(/(\{\w+\})/).map((part, i) => {
    const name = /^\{(\w+)\}$/.exec(part)?.[1];
    return <Fragment key={i}>{name !== undefined && name in vars ? vars[name] : highlight(part)}</Fragment>;
  });
}

export function withKeys(text: string, keys: readonly string[]): ReactNode {
  return highlight(text, keys);
}

// Highlighting of buttons and game texts inside translated sentences (src/i18n/rich.tsx).
import { createElement, Fragment } from "react";
import { renderToString } from "react-dom/server";
import { expect, test } from "vitest";
import { highlight } from "../src/i18n/rich";

const html = (text: string, keys: string[] = []) => renderToString(createElement(Fragment, null, highlight(text, keys)));

test("game words are highlighted on their own; common words are not", () => {
  expect(html("A reprise aparece depois do CONTINUE, com 2 frames.")).toBe('A reprise aparece depois do <span class="game-text">CONTINUE</span>, com 2 frames.');
  expect(html("O jogo lê SOUND e BUTTON MODE do menu OPTION (L=A conta).")).toBe(
    'O jogo lê <span class="game-text">SOUND</span> e <span class="game-text">BUTTON MODE</span> do menu <span class="game-text">OPTION</span> (<span class="game-text">L=A</span> conta).');
  expect(html("CONTINUED ou MONOTONE não são do jogo.")).toBe("CONTINUED ou MONOTONE não são do jogo.");
});

test("buttons only when requested", () => {
  expect(html("Aperte A em CONTINUE")).toBe('Aperte A em <span class="game-text">CONTINUE</span>');
  expect(html("Aperte A em CONTINUE", ["A"])).toBe('Aperte <kbd class="pad-key">A</kbd> em <span class="game-text">CONTINUE</span>');
});

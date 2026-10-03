// Glossary: same terms in both languages; guide markup catches only the first occurrence outside links, code and headings.
import { expect, test } from "vitest";
import { glossary, markTerms } from "../src/content/glossary";
import { guides } from "../src/content";

test("pt and en have the same terms, with text and without dashes", () => {
  const pt = glossary("pt");
  const en = glossary("en");
  expect(Object.keys(en).sort()).toEqual(Object.keys(pt).sort());
  for (const entry of [...Object.values(pt), ...Object.values(en)]) {
    expect(entry.terms.length).toBeGreaterThan(0);
    expect(entry.text.length).toBeGreaterThan(20);
    expect(/[—–]/.test(entry.text + entry.title)).toBe(false);
  }
});

test("marks only the first occurrence and skips links, code and headings", () => {
  const html = markTerms(
    '<h2>ACE</h2><p>Com a ACE e a <a href="#">ACE</a>, <code>PID</code>, depois o PID e o PID.</p><p>Nature e nature.</p>',
    glossary("pt"),
  );
  expect(html).toBe(
    '<h2>ACE</h2><p>Com a <button type="button" class="term" data-term="ace">ACE</button> e a <a href="#">ACE</a>, <code>PID</code>, '
    + 'depois o <button type="button" class="term" data-term="pid">PID</button> e o PID.</p>'
    + '<p><button type="button" class="term" data-term="nature">Nature</button> e nature.</p>',
  );
});

test("an acronym only matches whole and uppercase", () => {
  const html = markTerms("<p>Create 6IV Egg, o ivs e o OTAKU, depois TID e SID.</p>", glossary("pt"));
  expect(html).not.toContain('data-term="ivs"');
  expect(html).not.toContain('data-term="ot"');
  expect(html).toContain('<button type="button" class="term" data-term="tid">TID e SID</button>');
});

test("the first guide explains ACE at its first mention", () => {
  for (const lang of ["pt", "en"] as const) {
    const first = guides(lang)[0];
    expect(first.slug).toBe("safety");
    expect(first.html).toContain('data-term="ace">ACE</button>');
  }
});

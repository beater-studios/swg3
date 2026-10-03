// Guide body: the Markdown HTML with game screens in place of `:::screen name` markers (content/index.ts).

import type { ComponentType } from "react";
import { SCREEN_MARK } from "../content";
import { MailGlitch } from "./MailGlitch";

export const SCREENS: Record<string, ComponentType> = {
  "mail-glitch": MailGlitch,
};

export function GuideBody({ html }: { html: string }) {
  // split with a capture group alternates: HTML, screen name, HTML, screen name...
  const parts = html.split(new RegExp(SCREEN_MARK.source, "g"));
  return (
    <div className="md">
      {parts.map((part, i) => {
        if (i % 2 === 0) return part.trim() ? <div key={i} className="md-part" dangerouslySetInnerHTML={{ __html: part }} /> : null;
        const Screen = SCREENS[part];
        return Screen ? <Screen key={i} /> : null;
      })}
    </div>
  );
}

// Glitched Mail screens for the ACE guide. Images: tools/gen_mail_screen.py (src/easy_chat_3.c).

import glitch from "../assets/mail/glitch.png";
import first from "../assets/mail/first.png";
import second from "../assets/mail/second.png";
import { t } from "../i18n";
import { InGame } from "../ui";

/** Easy Chat word and its group (src/data/easy_chat). */
function Word({ word, group }: { word: string; group: string }) {
  return <><InGame>{word}</InGame> <span className="muted">({t("grupo")} {group})</span></>;
}

export function MailGlitch() {
  const screens = [
    {
      src: glitch, title: t("O Mail glitchado"),
      alt: t("Tela de escrever o Mail com as 9 palavras como ???"),
      text: <p>{t("Ele abre com as 9 palavras como ")}<InGame>???</InGame>{t(". Se for esta a tela, o Mail glitch deu certo.")}</p>,
    },
    {
      src: first, title: t("1º Mail"),
      alt: t("Mensagem do 1º Mail: ???, HIGHS, I CHOOSE YOU, WANDERING e o resto ???"),
      text: (
        <ol>
          <li>{t("1ª palavra: deixe ")}<InGame>???</InGame></li>
          <li><Word word="HIGHS" group="MISC." /></li>
          <li><Word word="I CHOOSE YOU" group="TRAINER" /></li>
          <li><Word word="WANDERING" group="ADJECTIVES" /></li>
        </ol>
      ),
    },
    {
      src: second, title: t("2º Mail"),
      alt: t("Mensagem do 2º Mail: ???, WANDERING, I CHOOSE YOU, HIGHS e o resto ???"),
      text: <p>{t("A mensagem do 1º aparece de novo. Só troque a 2ª e a 4ª: ")}<InGame>WANDERING</InGame>{t(" e ")}<InGame>HIGHS</InGame>.</p>,
    },
  ];
  return (
    <div className="mail-screens">
      {screens.map((s) => (
        <figure key={s.title} className="mail-screen">
          <img src={s.src} alt={s.alt} width={240} height={160} />
          <figcaption><b>{s.title}</b>{s.text}</figcaption>
        </figure>
      ))}
    </div>
  );
}

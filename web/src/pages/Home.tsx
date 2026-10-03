import { t } from "../i18n";
import { BrandName } from "../components/BrandName";
import { Actions, ButtonLink, CardGrid, Icon, LinkCard, Page, PageHeader, Panel, Table, Tag } from "../ui";

export function Home() {
  const cards = [
    { to: "/rng", icon: "dice", title: "RNG", text: t("Descubra em que momento aparece o shiny, a nature ou os IVs que você quer, e cronometre com o timer do próprio site.") },
    { to: "/editor", icon: "file", title: "Editor", text: t("Abra arquivos .pk3 e dos jogos do Switch, crie ou ajuste um Pokémon e veja como colocá-lo no seu jogo.") },
    { to: "/codes", icon: "box", title: t("Códigos"), text: t("Cole os nomes de box de um código e confira tudo antes de digitar, com a tecla certa de cada letra.") },
    { to: "/guides", icon: "map", title: t("Guias"), text: t("Passo a passo da ACE, do Base64 writer e da placa ESP32, com os cuidados para não perder o save.") },
  ];
  const ways = [
    { title: t("Só aqui no site"), text: t("Calcular, conferir e baixar arquivos. Não precisa de nada além do navegador."), tag: <Tag>{t("pronto")}</Tag> },
    { title: t("Digitando no jogo"), text: t("Com a ACE liberada no seu save, você digita nomes de box e o jogo executa. Dá para criar Pokémon sem nenhum hardware."), tag: <Tag>{t("pronto, com os códigos da comunidade")}</Tag> },
    { title: t("Com a placa ESP32"), text: t("Uma plaquinha barata conversa com o Switch como se fosse outro console e troca Pokémon direto com o PC."), tag: <Tag tone="warn">{t("em construção")}</Tag> },
  ];
  const rows = [
    [t("RNG"), t("achar o momento certo e cronometrar"), t("trocar a seed com um código"), t("planejado")],
    [t("Ver um Pokémon"), t("abrir o arquivo"), t("códigos que mostram PID, IVs e EVs"), t("receber por troca e salvar")],
    [t("Criar ou ajustar"), t("montar, conferir e baixar"), t("Base64 writer, com um código só"), t("mandar por troca")],
    [t("Códigos"), t("conferir antes de digitar"), t("guia caixa por caixa"), t("não precisa")],
  ];
  return (
    <Page title="">
      <div className="hero">
        <PageHeader eyebrow={t("FireRed e LeafGreen no Nintendo Switch")} title={<BrandName />}
          lead={t("Ache o frame certo do RNG, crie ou revise Pokémon e deixe os códigos da comunidade prontos para digitar. Tudo roda aqui no navegador, e nada do que você faz sai do seu computador.")} />
        <Actions>
          <ButtonLink variant="primary" to="/editor">{t("Criar um Pokémon")}</ButtonLink>
          <ButtonLink to="/rng">{t("Caçar com RNG")}</ButtonLink>
          <ButtonLink to="/guides/safety">{t("Proteja seu save primeiro")}</ButtonLink>
        </Actions>
      </div>
      <CardGrid>
        {cards.map((card) => (
          <LinkCard to={card.to} key={card.to}>
            <Icon name={card.icon} className="card-icon" />
            <h2>{card.title}</h2>
            <p>{card.text}</p>
          </LinkCard>
        ))}
      </CardGrid>
      <Panel>
        <h2>{t("Três jeitos de chegar ao seu jogo")}</h2>
        <p>{t("O jogo roda no emulador do Switch, fechado. Mesmo assim, dá para chegar nele de três formas, e você escolhe a que combina com o que tem em mãos.")}</p>
        <div className="ways">
          {ways.map((way) => (
            <div className="way" key={way.title}>
              <h3>{way.title}</h3>
              <p>{way.text}</p>
              {way.tag}
            </div>
          ))}
        </div>
      </Panel>
      <Panel>
        <h2>{t("O que dá para fazer de cada jeito")}</h2>
        <Table>
          <thead><tr><th></th><th>{t("só no site")}</th><th>{t("digitando no jogo")}</th><th>{t("com a ESP32")}</th></tr></thead>
            <tbody>
              {rows.map(([head, ...cells]) => (
                <tr key={head}><th scope="row">{head}</th>{cells.map((c) => <td key={c}>{c}</td>)}</tr>
              ))}
            </tbody>
        </Table>
      </Panel>
    </Page>
  );
}

import { t } from "../i18n";
import { ButtonLink, EmptyState, Page } from "../ui";

export function NotFound() {
  return (
    <Page title={t("Página não encontrada")}>
      <EmptyState actions={<>
        <ButtonLink variant="primary" to="/">{t("Ir para o início")}</ButtonLink>
        <ButtonLink to="/guides">{t("Ver os guias")}</ButtonLink>
      </>}>
        <p>{t("Não tem nada neste endereço. Talvez o link esteja velho ou com um erro de digitação.")}</p>
      </EmptyState>
    </Page>
  );
}

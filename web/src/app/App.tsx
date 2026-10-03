import { lazy, Suspense } from "react";
import { BrowserRouter, Route, Routes } from "react-router";
import { usePrefs } from "./prefs";
import { basename } from "./paths";
import { Layout } from "../components/Layout";
import { Home } from "../pages/Home";
import { GuidePage, GuidesIndex } from "../pages/Guides";
import { ContentPage } from "../pages/ContentPage";
import { CodesPage, PokemonPage, RngPage } from "../pages/tools";
import { NotFound } from "../pages/NotFound";
import { ChangelogPage } from "../pages/Changelog";

// Dev only.
const DesignPage = import.meta.env.DEV ? lazy(() => import("../design/DesignPage")) : null;

// Paths have no language prefix: the English router uses the /en basename (app/paths.ts).
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="rng" element={<RngPage />} />
        <Route path="editor" element={<PokemonPage />} />
        <Route path="codes" element={<CodesPage />} />
        <Route path="guides" element={<GuidesIndex />} />
        <Route path="guides/:slug" element={<GuidePage />} />
        <Route path="about" element={<ContentPage name="about" />} />
        <Route path="credits" element={<ContentPage name="credits" />} />
        <Route path="privacy" element={<ContentPage name="privacy" />} />
        <Route path="terms" element={<ContentPage name="terms" />} />
        <Route path="changelog" element={<ChangelogPage />} />
        {DesignPage && <Route path="design" element={<Suspense><DesignPage /></Suspense>} />}
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}

export function App() {
  // Remount on language change: all text goes through t() at render time.
  const { lang } = usePrefs();
  return (
    <BrowserRouter key={lang} basename={basename(lang)}>
      <AppRoutes />
    </BrowserRouter>
  );
}

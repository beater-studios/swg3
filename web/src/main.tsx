import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import "./ui";
import "./styles/site.css";
import { App } from "./app/App";
import { registerServiceWorker } from "./app/offline";
import { routeKey, routeOf } from "./app/routes";
import { preloadTool } from "./pages/tools";

const root = document.getElementById("root")!;
const meta = routeOf(window.location.pathname);
preloadTool(meta.path);
const app = <StrictMode><App /></StrictMode>;
// In dev, or for a path served by another page, the prerendered HTML does not match: mount from scratch.
if (root.dataset.route === routeKey(meta)) hydrateRoot(root, app);
else createRoot(root).render(app);
registerServiceWorker();

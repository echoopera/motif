import { createRoot } from "react-dom/client";
import type { ReactNode } from "react";
import { IslandContainerContext } from "@/lib/island";
import css from "./styles.css?inline";

let sheet: CSSStyleSheet | null = null;
const getSheet = () => { if (!sheet) { sheet = new CSSStyleSheet(); sheet.replaceSync(css); } return sheet; };
const isEditable = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || ["INPUT", "SELECT", "TEXTAREA"].includes(t.tagName) || t.getAttribute("role") === "slider" || t.getAttribute("role") === "spinbutton");

export interface Island { render(node: ReactNode): void; unmount(): void }
/**
 * Mount React inside a shadow root on `host`: the page's CSS can't reach in and Tailwind can't leak out. Plain keys typed into a control
 * stay inside (Motif's single-key shortcuts must not fire while a knob or field has focus); Ctrl/Cmd/Alt combinations and Escape pass through.
 */
export function mountIsland(host: HTMLElement, node: ReactNode): Island {
  // Motif's amber, captured on the light-DOM parent (the host itself redefines --accent): inside the shadow root --accent means shadcn's neutral hover surface.
  (host.parentElement ?? host).style.setProperty("--ms-accent", "var(--accent)");
  const root = host.shadowRoot ?? host.attachShadow({ mode: "open" });
  root.adoptedStyleSheets = [getSheet()];
  const box = document.createElement("div"); box.className = "ms-root dark"; root.replaceChildren(box);
  const stop = (e: KeyboardEvent) => {
    if (e.ctrlKey || e.metaKey || e.altKey || e.key === "Escape") return;
    if (/^[0-9]$/.test(e.key) && !isEditable(e.composedPath()[0] ?? null)) return; // pad hotkeys; Motif has no plain digit shortcuts
    e.stopPropagation();
  };
  box.addEventListener("keydown", stop); box.addEventListener("keyup", stop);
  const r = createRoot(box);
  const wrap = (n: ReactNode) => <IslandContainerContext.Provider value={box}>{n}</IslandContainerContext.Provider>;
  r.render(wrap(node));
  return { render: (n) => r.render(wrap(n)), unmount: () => r.unmount() };
}

import { createContext, useContext } from "react";

/** The element Base UI portals (popovers, selects, tooltips, menus) render into: inside the island's shadow root, so they keep its styles. */
export const IslandContainerContext = createContext<HTMLElement | null>(null);
export const useIslandContainer = (): HTMLElement | undefined => useContext(IslandContainerContext) ?? undefined;

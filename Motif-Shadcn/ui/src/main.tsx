import { mountIsland } from "@/island";
import { Console } from "@/pages/Console";
import { Pads } from "@/pages/Pads";
import type { MotifApi } from "@/lib/motif";

type Kind = "console" | "pads";
interface Props { api: MotifApi; rev: number; active: boolean }
const PAGES = { console: Console, pads: Pads } as const;

/** window.MotifShadcn: what the Motif shell's Console and Pads pages mount. */
const MotifShadcn = {
  version: "1.0.0",
  mount(kind: Kind, host: HTMLElement, props: Props) {
    const Page = PAGES[kind];
    const island = mountIsland(host, <Page {...props} />);
    return { update: (p: Props) => island.render(<Page {...p} />), unmount: () => island.unmount() };
  },
};
(window as unknown as { MotifShadcn: typeof MotifShadcn }).MotifShadcn = MotifShadcn;

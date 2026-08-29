import type { ReactNode } from "react";
import { createElement, Fragment } from "react";

const p = (d: string): ReactNode => createElement("path", { key: d, d });

/** Paths dos ícones no grid 24, traço 1.6 — ver docs/design-system.md §2.6. */
export const iconPaths: Record<string, ReactNode> = {
  pin: createElement(Fragment, null, [
    p("M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z"),
    createElement("circle", { key: "c", cx: 12, cy: 10, r: 2.6 })
  ]),
  calendar: createElement(Fragment, null, [
    createElement("rect", { key: "r", x: 4, y: 5, width: 16, height: 16, rx: 2 }),
    p("M4 10h16M9 3v4M15 3v4")
  ]),
  plane: p("M2 12l8-2 5-8 2 1-3 8 6 3v2l-7-1-3 5-2-1 1-5-4-2z"),
  hotel: p("M3 18v-6a2 2 0 0 1 2-2h10a4 4 0 0 1 4 4v4M3 14h18M6 10V7a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3M4 18v2M20 18v2"),
  meal: p("M6 3v8a3 3 0 0 0 6 0V3M9 11v10M17 3c-1.5 1-2 3-2 6s.5 4 2 4v8"),
  weather: createElement(Fragment, null, [
    createElement("circle", { key: "c", cx: 12, cy: 12, r: 4 }),
    p("M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M19 5l-2 2M7 17l-2 2")
  ]),
  clock: createElement(Fragment, null, [
    createElement("circle", { key: "c", cx: 12, cy: 12, r: 9 }),
    p("M12 7v5l3 2")
  ]),
  sparkle: p("M12 3l2 5 5 2-5 2-2 5-2-5-5-2 5-2z"),
  heart: p("M12 21s-7-4.6-9.3-9C1 8.5 3 5 6.5 5 9 5 12 7.5 12 7.5S15 5 17.5 5C21 5 23 8.5 21.3 12 19 16.4 12 21 12 21z"),
  "arrow-right": p("M5 12h14M13 6l6 6-6 6"),
  "arrow-left": p("M19 12H5M11 18l-6-6 6-6"),
  "chevron-down": p("M6 9l6 6 6-6"),
  "chevron-left": p("M15 6l-6 6 6 6"),
  check: p("M5 13l4 4L19 7"),
  close: p("M6 6l12 12M18 6L6 18"),
  plus: p("M12 5v14M5 12h14"),
  minus: p("M5 12h14"),
  search: createElement(Fragment, null, [
    createElement("circle", { key: "c", cx: 11, cy: 11, r: 7 }),
    p("M21 21l-4.3-4.3")
  ]),
  export: p("M12 3v12M7 10l5 5 5-5M5 21h14"),
  share: createElement(Fragment, null, [
    createElement("circle", { key: "a", cx: 6, cy: 12, r: 2.5 }),
    createElement("circle", { key: "b", cx: 18, cy: 6, r: 2.5 }),
    createElement("circle", { key: "c", cx: 18, cy: 18, r: 2.5 }),
    p("M8 11l8-4M8 13l8 4")
  ]),
  star: p("M12 3l2.6 6H21l-5 4 2 7-6-4-6 4 2-7-5-4h6.4z"),
  map: p("M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"),
  bell: p("M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 20a2 2 0 0 0 4 0"),
  user: createElement(Fragment, null, [
    createElement("circle", { key: "c", cx: 12, cy: 8, r: 4 }),
    p("M4 21a8 8 0 0 1 16 0")
  ])
};

export type IconName = keyof typeof iconPaths;
export const iconNames = Object.keys(iconPaths) as IconName[];

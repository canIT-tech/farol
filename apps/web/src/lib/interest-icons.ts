import { INTEREST_OPTIONS } from "./onboarding";

/** Traço de cada interesse, no mesmo desenho de linha do manual de marca.
 *  Só o `d` do path: o <svg> em volta é do componente. */
export const INTEREST_ICONS: Record<(typeof INTEREST_OPTIONS)[number], string> = {
  praia: "M3 18h18M6 18c0-4 3-7 7-7M13 11 6.5 8.5M13 11l2-6.5M13 11l6 2.5",
  montanha: "M3 19h18L14 7l-3.5 6L8 10z",
  gastronomia: "M5 3v8a2 2 0 0 0 4 0V3M7 11v10M15 3c-1.5 2-1.5 6 0 8v10",
  "vida noturna": "M5 4h14l-7 8zM12 12v7M8 21h8",
  "cultura e museus": "M3 9 12 4l9 5M5 9v9M10 9v9M14 9v9M19 9v9M3 21h18",
  natureza: "M12 21v-5M12 16c-3.5 0-6-2.5-6-6 0-4 3-7 6-7s6 3 6 7c0 3.5-2.5 6-6 6zM12 16V6",
  compras: "M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2",
  história: "M4 6a3 3 0 0 1 3-3h4v18H7a3 3 0 0 0-3 3zM20 6a3 3 0 0 0-3-3h-4v18h4a3 3 0 0 1 3 3z",
  aventura: "M3 20h18M7 20l5-14 5 14M9.5 12h5M12 6V3",
  relaxar: "M3 14h18a9 9 0 0 1-18 0zM12 14V3M8 6c0-2 8-2 8 0",
  arquitetura: "M4 21V8l8-5 8 5v13M9 21v-6h6v6",
  vinhos: "M8 3h8l-1 6a3 3 0 0 1-6 0zM12 15v6M9 21h6"
};

/** Interesses que ainda não têm traço próprio caem num marcador neutro. */
export const FALLBACK_ICON = "M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z";

export function interestIcon(interest: string): string {
  return INTEREST_ICONS[interest as keyof typeof INTEREST_ICONS] ?? FALLBACK_ICON;
}

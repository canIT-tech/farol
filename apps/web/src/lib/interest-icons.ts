import { INTEREST_OPTIONS } from "./onboarding";

/** Traço de cada interesse, no mesmo desenho de linha do manual de marca.
 *  Só o `d` do path: o <svg> em volta é do componente. */
export const INTEREST_ICONS: Record<(typeof INTEREST_OPTIONS)[number], string> = {
  praia: "M3 18h18M6 18c0-4 3-7 7-7M13 11 6.5 8.5M13 11l2-6.5M13 11l6 2.5",
  montanha: "M3 19h18L14 7l-3.5 6L8 10z",
  gastronomia: "M5 3v8a2 2 0 0 0 4 0V3M7 11v10M15 3c-1.5 2-1.5 6 0 8v10",
  "vida noturna": "M5 4h14l-7 8zM12 12v7M8 21h8",
  "cultura e museus": "M3 9 12 4l9 5M5 9v9M10 9v9M14 9v9M19 9v9M3 21h18",
  natureza: "M12 21v-6M12 15c-4 0-6-3-6-6a6 6 0 0 1 12 0c0 3-2 6-6 6z",
  compras: "M6 8h12l-1 12H7zM9 8V6a3 3 0 0 1 6 0v2",
  história: "M5 4h11l3 3v13H5zM9 9h6M9 13h6M9 17h4",
  aventura: "M4 20 20 4M14 4h6v6M8 16l-4 4",
  relaxar: "M4 15h16M6 15a6 6 0 0 1 12 0M12 9V4M9 20h6",
  arquitetura: "M4 21V8l8-5 8 5v13M9 21v-6h6v6",
  vinhos: "M8 3h8l-1 6a3 3 0 0 1-6 0zM12 15v6M9 21h6"
};

/** Interesses que ainda não têm traço próprio caem num marcador neutro. */
export const FALLBACK_ICON = "M12 21s-7-5.2-7-11a7 7 0 0 1 14 0c0 5.8-7 11-7 11Z";

export function interestIcon(interest: string): string {
  return INTEREST_ICONS[interest as keyof typeof INTEREST_ICONS] ?? FALLBACK_ICON;
}

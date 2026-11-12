import csv from "../../../../../packages/db/data/destinations.csv";
import { parseDestinationsCsv, type DestinationGuide } from "../../lib/destination-guides";

// Catálogo curado, lido em build. Uma lista e um índice por slug (O(1) na rota).
export const GUIDES: readonly DestinationGuide[] = parseDestinationsCsv(csv);

export const GUIDE_BY_SLUG: ReadonlyMap<string, DestinationGuide> = new Map(
  GUIDES.map((guide) => [guide.slug, guide])
);

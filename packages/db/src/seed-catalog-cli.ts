import { fileURLToPath } from "node:url";
import { seedCatalog, DEFAULT_CATALOG_CSV } from "./seed-catalog";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");

const csvPath = process.argv[2] ?? fileURLToPath(DEFAULT_CATALOG_CSV);

seedCatalog(url, csvPath)
  .then(({ inserted }) => {
    console.log(`destination_catalog: ${inserted} destinos aplicados`);
  })
  .catch((err: unknown) => {
    console.error(err);
    process.exitCode = 1;
  });

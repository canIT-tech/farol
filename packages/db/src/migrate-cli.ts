import { runMigrations } from "./migrate";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");

runMigrations(url).then(() => {
  // eslint-disable-next-line no-console
  console.log("migrations aplicadas");
});

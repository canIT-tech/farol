import { runMigrations } from "./migrate";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente");

runMigrations(url).then(() => {
  process.stdout.write("migrations aplicadas\n");
});

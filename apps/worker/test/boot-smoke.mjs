// Sobe `node dist/main.worker.js` e espera a linha worker_ready. Fora do
// Vitest de propósito: o Vite resolve import que o ESM do Node não resolve, e
// esconde processo que não sobe. Par do apps/api/test/boot-smoke.mjs.
import { spawn } from "node:child_process";

const TIMEOUT_MS = 60_000;
const READY = '"event":"worker_ready"';

const child = spawn(process.execPath, ["dist/main.worker.js"], {
  cwd: new URL("..", import.meta.url).pathname,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"]
});

const ok = await new Promise((resolve) => {
  let output = "";
  const timer = setTimeout(() => resolve(false), TIMEOUT_MS);

  const watch = (chunk) => {
    output += chunk;
    if (output.includes(READY)) {
      clearTimeout(timer);
      resolve(true);
    }
  };
  child.stdout.on("data", watch);
  child.stderr.on("data", watch);
  child.on("exit", (code) => {
    clearTimeout(timer);
    console.error(`worker saiu com ${code}. Saída:\n${output}`);
    resolve(false);
  });
});

if (ok) {
  console.log("boot smoke do worker ok");
}
child.kill("SIGTERM");
if (!ok) {
  process.exit(1);
}

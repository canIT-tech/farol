// Sobe `node dist/main.js` e espera /health 200. Fora do Vitest de propósito:
// o Vite resolve import que o ESM do Node não resolve, e esconde app que não sobe.
import { spawn } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const PORT = process.env.API_PORT ?? "3333";
const TIMEOUT_MS = 60_000;

const child = spawn(process.execPath, ["dist/main.js"], {
  cwd: new URL("..", import.meta.url).pathname,
  env: process.env,
  stdio: ["ignore", "pipe", "pipe"]
});

let output = "";
child.stdout.on("data", (c) => (output += c));
child.stderr.on("data", (c) => (output += c));

let exited = null;
child.on("exit", (code) => (exited = code));

const deadline = Date.now() + TIMEOUT_MS;
let ok = false;

while (Date.now() < deadline && exited === null) {
  try {
    const res = await fetch(`http://127.0.0.1:${PORT}/api/health`);
    if (res.ok) {
      console.log("boot smoke ok:", await res.text());
      ok = true;
      break;
    }
  } catch {
    // ainda subindo
  }
  await sleep(500);
}

child.kill("SIGTERM");

if (!ok) {
  console.error(`boot smoke FALHOU (exit=${exited}). Saída do processo:\n${output}`);
  process.exit(1);
}

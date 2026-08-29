import { describe, it, expect, beforeAll, afterAll } from "vitest";
import postgres from "postgres";
import {
  assertJobId,
  buildQueueOptions,
  deadLetterName,
  pollingSeconds,
  PgBossQueue
} from "./pgboss-queue";
import { consoleDeadLetterLogger, type DeadLetterEntry } from "./job-queue";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const SCHEMA = `pgboss_test_${Math.random().toString(36).slice(2, 8)}`;

const deadLetters: DeadLetterEntry[] = [];
let queue: PgBossQueue;

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<void> {
  const start = Date.now();
  while (!predicate() && Date.now() - start < timeoutMs) {
    await new Promise((r) => setTimeout(r, 100));
  }
}

beforeAll(async () => {
  queue = new PgBossQueue(
    {
      url,
      schema: SCHEMA,
      pollingIntervalSeconds: 0.5,
      retryLimit: 1,
      retryBackoff: false,
      retryDelaySeconds: 0
    },
    { warn: (entry) => deadLetters.push(entry) }
  );
  await queue.onModuleInit();
});

afterAll(async () => {
  await queue.onModuleDestroy();
  const client = postgres(url, { max: 1 });
  try {
    await client.unsafe(`drop schema if exists "${SCHEMA}" cascade`);
  } finally {
    await client.end({ timeout: 5 });
  }
});

describe("deadLetterName", () => {
  it("sufixa o nome da fila", () => {
    expect(deadLetterName("itinerary.generate")).toBe("itinerary.generate.__dlq");
  });
});

describe("consoleDeadLetterLogger", () => {
  it("emite um JSON estruturado com o evento job_dead_letter", () => {
    const original = console.warn;
    const lines: string[] = [];
    console.warn = (msg: string) => lines.push(msg);
    try {
      consoleDeadLetterLogger.warn({ name: "itinerary.generate", jobId: "j-1", data: { x: 1 } });
    } finally {
      console.warn = original;
    }
    expect(lines).toHaveLength(1);
    expect(JSON.parse(lines[0]!)).toEqual({
      event: "job_dead_letter",
      name: "itinerary.generate",
      jobId: "j-1",
      data: { x: 1 }
    });
  });
});

describe("PgBossQueue construção", () => {
  it("constrói com config mínima (usa o polling default)", () => {
    expect(() => new PgBossQueue({ url: "postgres://x", schema: "s" })).not.toThrow();
  });
});

describe("assertJobId", () => {
  it("devolve o id quando presente", () => {
    expect(assertJobId("abc", "q")).toBe("abc");
  });

  it("lança quando o id é null", () => {
    expect(() => assertJobId(null, "itinerary.generate")).toThrow(/itinerary\.generate/);
  });
});

describe("buildQueueOptions", () => {
  it("usa os defaults do design quando a config não informa", () => {
    const opts = buildQueueOptions("q", { url: "x", schema: "s" });
    expect(opts).toStrictEqual({
      retryLimit: 3,
      retryBackoff: true,
      expireInSeconds: 300,
      deadLetter: "q.__dlq"
    });
    expect(opts).not.toHaveProperty("retryDelay");
  });

  it("respeita os overrides e inclui retryDelay só quando informado", () => {
    const opts = buildQueueOptions("q", {
      url: "x",
      schema: "s",
      retryLimit: 1,
      retryBackoff: false,
      expireInSeconds: 30,
      retryDelaySeconds: 0
    });
    expect(opts).toEqual({
      retryLimit: 1,
      retryBackoff: false,
      expireInSeconds: 30,
      deadLetter: "q.__dlq",
      retryDelay: 0
    });
  });
});

describe("pollingSeconds", () => {
  it("usa o default de 2s quando a config não informa", () => {
    expect(pollingSeconds({ url: "x", schema: "s" })).toBe(2);
  });

  it("respeita o valor informado", () => {
    expect(pollingSeconds({ url: "x", schema: "s", pollingIntervalSeconds: 0.5 })).toBe(0.5);
  });
});

describe("PgBossQueue (pg-boss real)", () => {
  it("publish -> work entrega o payload ao handler", { timeout: 15000 }, async () => {
    const received: Array<{ n: number }> = [];
    await queue.work<{ n: number }>("t.echo", async (data) => {
      received.push(data);
    });
    const id = await queue.publish("t.echo", { n: 7 });
    expect(typeof id).toBe("string");

    await waitFor(() => received.length > 0, 8000);
    expect(received).toEqual([{ n: 7 }]);
  });

  it("registrar o mesmo nome duas vezes não recria a fila (memoização)", async () => {
    await expect(queue.work("t.echo", async () => {})).resolves.toBeUndefined();
  });

  it("um handler que falha uma vez é reprocessado (retry do pg-boss)", { timeout: 20000 }, async () => {
    let attempts = 0;
    await queue.work("t.retry", async () => {
      attempts += 1;
      if (attempts === 1) {
        throw new Error("falha proposital");
      }
    });
    await queue.publish("t.retry", { k: 1 });

    await waitFor(() => attempts >= 2, 15000);
    expect(attempts).toBe(2);
  });

  it("esgotados os retries, o job cai no dead-letter e é logado", { timeout: 30000 }, async () => {
    await queue.work("t.always-fail", async () => {
      throw new Error("sempre falha");
    });
    await queue.publish("t.always-fail", { boom: true });

    await waitFor(() => deadLetters.some((e) => e.name === "t.always-fail"), 20000);
    const entry = deadLetters.find((e) => e.name === "t.always-fail");
    expect(entry).toBeDefined();
    expect(entry!.data).toEqual({ boom: true });
    expect(typeof entry!.jobId).toBe("string");
  });
});

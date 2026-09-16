import { Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { PgBoss } from "pg-boss";
import {
  consoleDeadLetterLogger,
  type DeadLetterLogger,
  type JobQueue
} from "./job-queue";

// Config da fila (design §9): retry 3x com backoff, job expira em 5 min.
const DEFAULT_RETRY_LIMIT = 3;
const DEFAULT_RETRY_BACKOFF = true;
const DEFAULT_EXPIRE_IN_SECONDS = 300;
const DEFAULT_POLLING_SECONDS = 2;

export interface PgBossQueueConfig {
  url: string;
  schema: string;
  pollingIntervalSeconds?: number;
  retryLimit?: number;
  retryBackoff?: boolean;
  retryDelaySeconds?: number;
  expireInSeconds?: number;
}

export function deadLetterName(name: string): string {
  return `${name}.__dlq`;
}

interface QueueCreateOptions {
  retryLimit: number;
  retryBackoff: boolean;
  expireInSeconds: number;
  deadLetter: string;
  retryDelay?: number;
}

// Opções aplicadas a cada fila principal (o DLQ usa o default do pg-boss).
export function buildQueueOptions(name: string, config: PgBossQueueConfig): QueueCreateOptions {
  const options: QueueCreateOptions = {
    retryLimit: config.retryLimit ?? DEFAULT_RETRY_LIMIT,
    retryBackoff: config.retryBackoff ?? DEFAULT_RETRY_BACKOFF,
    expireInSeconds: config.expireInSeconds ?? DEFAULT_EXPIRE_IN_SECONDS,
    deadLetter: deadLetterName(name)
  };
  if (config.retryDelaySeconds !== undefined) {
    options.retryDelay = config.retryDelaySeconds;
  }
  return options;
}

export function pollingSeconds(config: PgBossQueueConfig): number {
  return config.pollingIntervalSeconds ?? DEFAULT_POLLING_SECONDS;
}

// Garante que o job foi enfileirado (send devolve null em colisão de singleton/throttle).
export function assertJobId(id: string | null, name: string): string {
  if (id === null) {
    throw new Error(`pg-boss não enfileirou o job "${name}"`);
  }
  return id;
}

@Injectable()
export class PgBossQueue implements JobQueue, OnModuleInit, OnModuleDestroy {
  private readonly boss: PgBoss;
  private readonly ensured = new Set<string>();

  constructor(
    private readonly config: PgBossQueueConfig,
    private readonly deadLetterLogger: DeadLetterLogger = consoleDeadLetterLogger
  ) {
    this.boss = new PgBoss({
      connectionString: config.url,
      schema: config.schema,
      supervise: true
    });
  }

  async onModuleInit(): Promise<void> {
    await this.boss.start();
  }

  async onModuleDestroy(): Promise<void> {
    await this.boss.stop({ graceful: false });
  }

  private async ensureQueue(name: string): Promise<void> {
    if (this.ensured.has(name)) {
      return;
    }
    await this.boss.createQueue(deadLetterName(name));
    await this.boss.createQueue(name, buildQueueOptions(name, this.config));
    this.ensured.add(name);
  }

  async publish<T extends object>(name: string, data: T): Promise<string> {
    await this.ensureQueue(name);
    return assertJobId(await this.boss.send(name, data), name);
  }

  async work<T>(
    name: string,
    handler: (data: T) => Promise<void>,
    onDeadLetter?: (data: T) => Promise<void>
  ): Promise<void> {
    await this.ensureQueue(name);
    const options = { pollingIntervalSeconds: pollingSeconds(this.config) };
    await this.boss.work<T>(name, options, async (jobs) => {
      for (const job of jobs) {
        await handler(job.data);
      }
    });
    await this.boss.work<T>(deadLetterName(name), options, async (jobs) => {
      for (const job of jobs) {
        this.deadLetterLogger.warn({ name, jobId: job.id, data: job.data });
        await onDeadLetter?.(job.data);
      }
    });
  }
}

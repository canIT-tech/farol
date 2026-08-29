// Token de injeção da fila de jobs.
export const JOB_QUEUE = Symbol("JOB_QUEUE");

// Superfície mínima que api e worker usam. A api só publica; o worker registra handlers.
export interface JobQueue {
  publish<T extends object>(name: string, data: T): Promise<string>;
  work<T>(name: string, handler: (data: T) => Promise<void>): Promise<void>;
}

export interface DeadLetterEntry {
  name: string;
  jobId: string;
  data: unknown;
}

export interface DeadLetterLogger {
  warn(entry: DeadLetterEntry): void;
}

export const consoleDeadLetterLogger: DeadLetterLogger = {
  warn: (entry) => {
    console.warn(JSON.stringify({ event: "job_dead_letter", ...entry }));
  }
};

// Token de injeção da fila de jobs.
export const JOB_QUEUE = Symbol("JOB_QUEUE");

// Superfície mínima que api e worker usam. A api só publica; o worker registra handlers.
export interface JobQueue {
  publish<T extends object>(name: string, data: T): Promise<string>;
  // onDeadLetter roda quando o job esgota as retentativas: é o único ponto
  // que sabe que a falha foi definitiva (spec pagamento 2026-09-15 §5).
  work<T>(
    name: string,
    handler: (data: T) => Promise<void>,
    onDeadLetter?: (data: T) => Promise<void>
  ): Promise<void>;
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

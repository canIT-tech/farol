export class CircuitOpenError extends Error {
  constructor() {
    super("circuito aberto — provider indisponível");
    this.name = "CircuitOpenError";
  }
}

export type CircuitState = "closed" | "open";

export interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
  now?: () => number;
}

// Circuit breaker simples (design §7.2): N falhas seguidas abrem o circuito e
// rejeitam rápido durante o cooldown. Passado o cooldown, uma chamada é deixada
// passar — se sucede, fecha; se falha, reabre com novo cooldown.
export class CircuitBreaker {
  private state: CircuitState = "closed";
  private failures = 0;
  private openedAt = 0;
  private readonly now: () => number;

  constructor(private readonly cfg: CircuitBreakerConfig) {
    this.now = cfg.now ?? (() => Date.now());
  }

  get currentState(): CircuitState {
    return this.state;
  }

  async exec<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === "open" && this.now() - this.openedAt < this.cfg.cooldownMs) {
      throw new CircuitOpenError();
    }

    try {
      const result = await fn();
      this.failures = 0;
      this.state = "closed";
      return result;
    } catch (err) {
      this.failures += 1;
      if (this.failures >= this.cfg.failureThreshold) {
        this.state = "open";
        this.openedAt = this.now();
      }
      throw err;
    }
  }
}

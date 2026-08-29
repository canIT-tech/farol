export interface AmadeusAuthConfig {
  baseUrl: string;
  clientId: string;
  clientSecret: string;
  fetchImpl?: typeof fetch;
  now?: () => number;
}

// Margem antes do exp para não usar um token prestes a expirar.
const TOKEN_MARGIN_MS = 30_000;

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

// OAuth2 client-credentials do Amadeus (design §7.2). Guarda o token em memória
// e só o renova quando (now + margem) passa do exp.
export class AmadeusAuth {
  private token: string | null = null;
  private expiresAt = 0;
  private readonly fetchImpl: typeof fetch;
  private readonly now: () => number;

  constructor(private readonly cfg: AmadeusAuthConfig) {
    this.fetchImpl = cfg.fetchImpl ?? fetch;
    this.now = cfg.now ?? (() => Date.now());
  }

  async getToken(): Promise<string> {
    if (this.token !== null && this.now() < this.expiresAt) {
      return this.token;
    }

    const res = await this.fetchImpl(`${this.cfg.baseUrl}/v1/security/oauth2/token`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        client_id: this.cfg.clientId,
        client_secret: this.cfg.clientSecret
      }).toString()
    });

    if (!res.ok) {
      throw new Error(`Amadeus auth falhou: ${res.status}`);
    }

    const json = (await res.json()) as TokenResponse;
    this.token = json.access_token;
    this.expiresAt = this.now() + json.expires_in * 1000 - TOKEN_MARGIN_MS;
    return this.token;
  }
}

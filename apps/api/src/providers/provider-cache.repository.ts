import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { providerCache, type Database } from "@farol/db";
import { DB } from "../db/db.module";

// Chave canônica: params com chaves ordenadas → hash estável independente da ordem.
export function cacheKey(provider: string, endpoint: string, params: Record<string, unknown>): string {
  const sorted = Object.keys(params)
    .sort()
    .map((key) => [key, params[key]] as const);
  const canonical = JSON.stringify(sorted);
  return createHash("sha256").update(`${provider}|${endpoint}|${canonical}`).digest("hex");
}

export interface GetOrSetArgs<T> {
  provider: string;
  endpoint: string;
  params: Record<string, unknown>;
  ttlSeconds: number;
  load: () => Promise<T>;
}

@Injectable()
export class ProviderCacheRepository {
  constructor(@Inject(DB) private readonly db: Database) {}

  async getOrSet<T>(args: GetOrSetArgs<T>): Promise<{ value: T; stale: boolean }> {
    const key = cacheKey(args.provider, args.endpoint, args.params);
    const now = new Date();

    const rows = await this.db.select().from(providerCache).where(eq(providerCache.key, key));
    const hit = rows[0];
    if (hit !== undefined && hit.expiresAt > now) {
      return { value: hit.payload as T, stale: false };
    }

    const value = await args.load();
    const expiresAt = new Date(now.getTime() + args.ttlSeconds * 1000);
    await this.db
      .insert(providerCache)
      .values({ key, provider: args.provider, payload: value, fetchedAt: now, expiresAt })
      .onConflictDoUpdate({
        target: providerCache.key,
        set: { payload: value, fetchedAt: now, expiresAt }
      });

    return { value, stale: false };
  }
}

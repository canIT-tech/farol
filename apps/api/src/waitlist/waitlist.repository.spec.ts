import { describe, it, expect, afterAll, afterEach } from "vitest";
import { inArray } from "drizzle-orm";
import { createDbClient, waitlist } from "@farol/db";
import { WaitlistRepository } from "./waitlist.repository";

const url = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL ausente para os testes de @farol/api");

const { db, close } = createDbClient(url);
const repo = new WaitlistRepository(db);
const emails: string[] = [];

function newEmail(): string {
  const email = `wl-${crypto.randomUUID()}@farol.test`;
  emails.push(email);
  return email;
}

afterEach(async () => {
  if (emails.length > 0) {
    await db.delete(waitlist).where(inArray(waitlist.email, emails));
    emails.length = 0;
  }
});
afterAll(() => close());

describe("WaitlistRepository", () => {
  it("add cria a linha e devolve true", async () => {
    const email = newEmail();
    await expect(repo.add(email, "landing-hero")).resolves.toBe(true);

    const rows = await db.select().from(waitlist).where(inArray(waitlist.email, [email]));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe("landing-hero");
  });

  it("add do mesmo e-mail de novo devolve false e não duplica", async () => {
    const email = newEmail();
    await repo.add(email, null);
    await expect(repo.add(email, "outra-origem")).resolves.toBe(false);

    const rows = await db.select().from(waitlist).where(inArray(waitlist.email, [email]));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBeNull();
  });

  it("markWelcomeSent preenche welcome_sent_at só daquele e-mail", async () => {
    const sent = newEmail();
    const other = newEmail();
    await repo.add(sent, null);
    await repo.add(other, null);
    const before = Date.now();

    await repo.markWelcomeSent(sent);

    const rows = await db.select().from(waitlist).where(inArray(waitlist.email, [sent, other]));
    const bySent = rows.find((r) => r.email === sent)!;
    const byOther = rows.find((r) => r.email === other)!;
    expect(bySent.welcomeSentAt).toBeInstanceOf(Date);
    expect(bySent.welcomeSentAt!.getTime()).toBeGreaterThanOrEqual(before - 1000);
    expect(byOther.welcomeSentAt).toBeNull();
  });

  it("count reflete as linhas gravadas", async () => {
    const before = await repo.count();
    await repo.add(newEmail(), null);
    await repo.add(newEmail(), null);
    const after = await repo.count();
    expect(after).toBe(before + 2);
    expect(Number.isInteger(after)).toBe(true);
  });
});

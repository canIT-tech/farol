import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { inArray } from "drizzle-orm";
import { createDbClient, waitlist } from "@farol/db";
import { AppModule } from "../src/app.module";

const dbUrl = process.env.DATABASE_URL_TEST ?? process.env.DATABASE_URL;
if (!dbUrl) throw new Error("DATABASE_URL ausente para o e2e de waitlist");

let app: INestApplication;
const { db, close } = createDbClient(dbUrl);
const emails: string[] = [];

function track(email: string): string {
  emails.push(email.toLowerCase());
  return email;
}

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
});

afterAll(async () => {
  if (emails.length > 0) {
    await db.delete(waitlist).where(inArray(waitlist.email, emails));
  }
  await app.close();
  await close();
});

describe("waitlist", () => {
  it("POST /waitlist cria o cadastro e responde { ok: true, created: true }", async () => {
    const email = track(`WL-${crypto.randomUUID()}@Farol.Test`);
    const res = await request(app.getHttpServer()).post("/waitlist").send({ email, source: "landing-hero" });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, created: true });

    const rows = await db.select().from(waitlist).where(inArray(waitlist.email, [email.toLowerCase()]));
    expect(rows).toHaveLength(1);
    expect(rows[0]!.source).toBe("landing-hero");
  });

  it("POST /waitlist do mesmo e-mail responde created: false e não duplica", async () => {
    const email = track(`wl-${crypto.randomUUID()}@farol.test`);
    await request(app.getHttpServer()).post("/waitlist").send({ email });
    const res = await request(app.getHttpServer()).post("/waitlist").send({ email });
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true, created: false });

    const rows = await db.select().from(waitlist).where(inArray(waitlist.email, [email]));
    expect(rows).toHaveLength(1);
  });

  it("POST /waitlist com e-mail inválido responde 400", async () => {
    const res = await request(app.getHttpServer()).post("/waitlist").send({ email: "não-é-email" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("validation");
  });

  it("GET /waitlist/count responde a contagem atual", async () => {
    const first = await request(app.getHttpServer()).get("/waitlist/count");
    expect(first.status).toBe(200);
    expect(typeof first.body.count).toBe("number");

    await request(app.getHttpServer())
      .post("/waitlist")
      .send({ email: track(`wl-${crypto.randomUUID()}@farol.test`) });

    const second = await request(app.getHttpServer()).get("/waitlist/count");
    expect(second.body.count).toBe(first.body.count + 1);
  });
});

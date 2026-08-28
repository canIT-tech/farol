import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { AppModule } from "../src/app.module";

let app: INestApplication;

beforeAll(async () => {
  const mod = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = mod.createNestApplication();
  await app.init();
});

afterAll(() => app.close());

describe("GET /health", () => {
  it("responde 200 e o shape do healthResponseSchema", async () => {
    const res = await request(app.getHttpServer()).get("/health");
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", checks: { db: "up" } });
    expect(typeof res.body.version).toBe("string");
  });
});

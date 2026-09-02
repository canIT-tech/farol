import { describe, it, expect } from "vitest";
import { FakeEmailProvider } from "./fake-email.provider";

describe("FakeEmailProvider", () => {
  it("guarda as mensagens na ordem, sem enviar", async () => {
    const fake = new FakeEmailProvider();
    await fake.send({ to: "a@farol.app", subject: "1", text: "um" });
    await fake.send({ to: "b@farol.app", subject: "2", text: "dois" });
    expect(fake.sent).toEqual([
      { to: "a@farol.app", subject: "1", text: "um" },
      { to: "b@farol.app", subject: "2", text: "dois" }
    ]);
  });
});

import { describe, it, expect, vi } from "vitest";
import { ProfileController } from "./profile.controller";
import type { ProfileService } from "./profile.service";
import type { TasteProfileInput } from "@farol/shared";

const user = { id: "u-1", email: "a@b.com" };
const input: TasteProfileInput = {
  interests: ["praia", "gastronomia", "sossego"],
  pace: "moderado",
  partyType: "casal",
  budgetBand: "medio",
  constraints: {}
};

describe("ProfileController", () => {
  it("GET delega para ProfileService.get com o id do usuário", async () => {
    const profile = { get: vi.fn().mockResolvedValue({ id: "p-1" }), upsert: vi.fn() };
    const controller = new ProfileController(profile as unknown as ProfileService);
    await expect(controller.get(user)).resolves.toEqual({ id: "p-1" });
    expect(profile.get).toHaveBeenCalledWith("u-1");
  });

  it("PUT delega para ProfileService.upsert com o id do usuário e o body", async () => {
    const profile = { get: vi.fn(), upsert: vi.fn().mockResolvedValue({ id: "p-2" }) };
    const controller = new ProfileController(profile as unknown as ProfileService);
    await expect(controller.put(user, input)).resolves.toEqual({ id: "p-2" });
    expect(profile.upsert).toHaveBeenCalledWith("u-1", input);
  });
});

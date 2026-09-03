import { describe, it, expect, vi } from "vitest";

const authSignOut = vi.fn(async () => ({ error: null }));
vi.mock("./supabase", () => ({
  getSupabaseBrowserClient: () => ({ auth: { signOut: authSignOut } })
}));

import { signOut } from "./session";

describe("signOut", () => {
  it("encerra a sessão pelo cliente do Supabase", async () => {
    await signOut();
    expect(authSignOut).toHaveBeenCalledTimes(1);
  });
});

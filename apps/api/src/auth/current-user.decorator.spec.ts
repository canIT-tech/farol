import { describe, it, expect } from "vitest";
import type { ExecutionContext } from "@nestjs/common";
import { currentUserFromContext, CurrentUser } from "./current-user.decorator";

function ctxWith(currentUser: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => ({ currentUser }) })
  } as unknown as ExecutionContext;
}

describe("currentUserFromContext", () => {
  it("devolve request.currentUser", () => {
    const user = { id: "u-1", email: "a@b.com" };
    expect(currentUserFromContext(undefined, ctxWith(user))).toEqual(user);
  });

  it("devolve undefined quando não há currentUser no request", () => {
    expect(currentUserFromContext(undefined, ctxWith(undefined))).toBeUndefined();
  });

  it("exporta um param decorator", () => {
    expect(typeof CurrentUser).toBe("function");
  });
});

// @ts-nocheck
import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ThemeProvider, useTheme } from "./ThemeProvider";

afterEach(() => {
  cleanup();
  document.documentElement.removeAttribute("data-theme");
});

function Probe() {
  const { theme, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <button onClick={() => setTheme("dark")}>escuro</button>
      <button onClick={() => setTheme("light")}>claro</button>
      <button onClick={() => setTheme("system")}>sistema</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  it("theme=dark carimba data-theme no root", () => {
    render(
      <ThemeProvider theme="dark">
        <Probe />
      </ThemeProvider>
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    expect(screen.getByTestId("theme")).toHaveTextContent("dark");
  });

  it("theme=light carimba data-theme=light", () => {
    render(
      <ThemeProvider theme="light">
        <Probe />
      </ThemeProvider>
    );
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });

  it("theme=system (default) remove o atributo", () => {
    document.documentElement.setAttribute("data-theme", "dark");
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
    expect(screen.getByTestId("theme")).toHaveTextContent("system");
  });

  it("setTheme alterna em ambas as direções", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <Probe />
      </ThemeProvider>
    );
    await user.click(screen.getByRole("button", { name: "escuro" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    await user.click(screen.getByRole("button", { name: "claro" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
    await user.click(screen.getByRole("button", { name: "sistema" }));
    expect(document.documentElement.hasAttribute("data-theme")).toBe(false);
  });

  it("useTheme fora do provider lança", () => {
    function Orphan() {
      useTheme();
      return null;
    }
    expect(() => render(<Orphan />)).toThrow(/ThemeProvider/);
  });
});

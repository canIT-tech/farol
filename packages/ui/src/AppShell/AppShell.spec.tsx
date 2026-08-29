import { describe, it, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AppShell } from "./AppShell";

afterEach(cleanup);

describe("AppShell", () => {
  it("renderiza as três regiões com aria-label", () => {
    render(
      <AppShell sidebar={<p>lado</p>} rail={<p>chat</p>}>
        <p>miolo</p>
      </AppShell>
    );
    expect(screen.getByRole("complementary", { name: "Navegação da viagem" })).toHaveTextContent("lado");
    expect(screen.getByRole("main", { name: "Conteúdo" })).toHaveTextContent("miolo");
    expect(screen.getByRole("complementary", { name: "Assessor" })).toHaveTextContent("chat");
  });

  it("o gatilho de menu alterna aria-expanded, o label e a classe do root", async () => {
    const { container } = render(
      <AppShell sidebar={<p>lado</p>} rail={<p>chat</p>}>
        <p>miolo</p>
      </AppShell>
    );
    const root = container.firstElementChild as HTMLElement;
    const toggle = screen.getByRole("button", { name: "Menu" });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(root.className).toBe("farol-shell");

    await userEvent.click(toggle);
    const closed = screen.getByRole("button", { name: "Fechar menu" });
    expect(closed).toHaveAttribute("aria-expanded", "true");
    expect(root.className).toBe("farol-shell farol-shell--sidebar-open");

    await userEvent.click(closed);
    expect(screen.getByRole("button", { name: "Menu" })).toHaveAttribute("aria-expanded", "false");
    expect(root.className).toBe("farol-shell");
  });

  it("aria-controls do gatilho aponta para o id da sidebar", () => {
    render(
      <AppShell sidebar={<p>lado</p>} rail={<p>chat</p>}>
        <p>miolo</p>
      </AppShell>
    );
    const controls = screen.getByRole("button", { name: "Menu" }).getAttribute("aria-controls");
    expect(controls).toBeTruthy();
    expect(
      screen.getByRole("complementary", { name: "Navegação da viagem" }).id
    ).toBe(controls);
  });
});

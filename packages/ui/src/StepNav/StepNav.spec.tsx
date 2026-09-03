import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StepNav, type Step } from "./StepNav";

afterEach(cleanup);

const steps: Step[] = [
  { id: "taste", label: "Perfil de gosto", state: "done" },
  { id: "dest", label: "Escolher destino", state: "current" },
  { id: "itin", label: "Roteiro", state: "todo" }
];

describe("StepNav", () => {
  it("done é um botão que navega; todo e current não são botões", () => {
    const onNavigate = vi.fn();
    render(<StepNav steps={steps} onNavigate={onNavigate} />);
    expect(screen.getByRole("button", { name: "Perfil de gosto" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Escolher destino" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Roteiro" })).not.toBeInTheDocument();
  });

  it("clicar num done chama onNavigate com o id", async () => {
    const onNavigate = vi.fn();
    render(<StepNav steps={steps} onNavigate={onNavigate} />);
    await userEvent.click(screen.getByRole("button", { name: "Perfil de gosto" }));
    expect(onNavigate).toHaveBeenCalledWith("taste");
  });

  it("sem onNavigate, done não vira botão", () => {
    render(<StepNav steps={steps} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByText("Perfil de gosto").tagName).toBe("SPAN");
  });

  it("current marca aria-current=step; os outros não", () => {
    render(<StepNav steps={steps} onNavigate={() => {}} />);
    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });

  it("aplica classe de estado por item", () => {
    render(<StepNav steps={steps} />);
    const items = screen.getAllByRole("listitem");
    expect(items[0].className).toContain("farol-stepnav__item--done");
    expect(items[1].className).toContain("farol-stepnav__item--current");
    expect(items[2].className).toContain("farol-stepnav__item--todo");
  });

  it("marca com visto só os passos concluídos", () => {
    const { container } = render(
      <StepNav
        steps={[
          { id: "a", label: "Perfil", state: "done" },
          { id: "b", label: "Destino", state: "current" },
          { id: "c", label: "Roteiro", state: "todo" }
        ]}
      />
    );
    expect(container.querySelectorAll(".farol-stepnav__marker")).toHaveLength(3);
    expect(container.querySelectorAll(".farol-stepnav__marker svg")).toHaveLength(1);
  });
});

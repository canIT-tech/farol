import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";
import { Icon } from "./Icon";
import { iconNames } from "./icons";

afterEach(cleanup);

describe("Icon", () => {
  it("cada nome do set renderiza um <svg> 24 com traço 1.6", () => {
    for (const name of iconNames) {
      const { container, unmount } = render(<Icon name={name} />);
      const svg = container.querySelector("svg")!;
      expect(svg.getAttribute("viewBox")).toBe("0 0 24 24");
      expect(svg.getAttribute("stroke-width")).toBe("1.6");
      expect(svg.querySelector("path, circle, rect")).toBeTruthy();
      unmount();
    }
  });

  it("size aplica width e height", () => {
    const { container } = render(<Icon name="pin" size={16} />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("width")).toBe("16");
    expect(svg.getAttribute("height")).toBe("16");
  });

  it("size padrão é 20", () => {
    const { container } = render(<Icon name="pin" />);
    expect(container.querySelector("svg")!.getAttribute("width")).toBe("20");
  });

  it("com title: role=img, <title> e sem aria-hidden", () => {
    const { container, getByText } = render(<Icon name="pin" title="Local" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("role")).toBe("img");
    expect(svg.hasAttribute("aria-hidden")).toBe(false);
    expect(getByText("Local").tagName.toLowerCase()).toBe("title");
  });

  it("sem title: aria-hidden e sem role", () => {
    const { container } = render(<Icon name="pin" />);
    const svg = container.querySelector("svg")!;
    expect(svg.getAttribute("aria-hidden")).toBe("true");
    expect(svg.hasAttribute("role")).toBe(false);
    expect(svg.querySelector("title")).toBeNull();
  });

  it("o set tem ao menos 20 ícones e nomes únicos", () => {
    expect(iconNames.length).toBeGreaterThanOrEqual(20);
    expect(new Set(iconNames).size).toBe(iconNames.length);
  });
});

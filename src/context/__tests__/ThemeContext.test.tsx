import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ThemeProvider, useTheme } from "@/context/ThemeContext";

const Probe = () => {
  const { theme, resolved, cycle, setTheme } = useTheme();
  return (
    <div>
      <span data-testid="theme">{theme}</span>
      <span data-testid="resolved">{resolved}</span>
      <button onClick={cycle}>cycle</button>
      <button onClick={() => setTheme("dark")}>force-dark</button>
      <button onClick={() => setTheme("light")}>force-light</button>
    </div>
  );
};

describe("ThemeProvider", () => {
  it("defaults to system → light when matchMedia returns false", () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("theme").textContent).toBe("system");
    expect(screen.getByTestId("resolved").textContent).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("setTheme('dark') applies the class and persists", () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => { screen.getByText("force-dark").click(); });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("vci.theme")).toBe("dark");
  });

  it("cycles light → dark → system → light", () => {
    render(<ThemeProvider><Probe /></ThemeProvider>);
    act(() => { screen.getByText("force-light").click(); });
    expect(screen.getByTestId("theme").textContent).toBe("light");
    act(() => { screen.getByText("cycle").click(); });
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    act(() => { screen.getByText("cycle").click(); });
    expect(screen.getByTestId("theme").textContent).toBe("system");
    act(() => { screen.getByText("cycle").click(); });
    expect(screen.getByTestId("theme").textContent).toBe("light");
  });

  it("rehydrates from localStorage", () => {
    localStorage.setItem("vci.theme", "dark");
    render(<ThemeProvider><Probe /></ThemeProvider>);
    expect(screen.getByTestId("theme").textContent).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});

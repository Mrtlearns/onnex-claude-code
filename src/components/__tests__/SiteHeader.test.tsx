import { describe, it, expect } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OSProvider, useOS } from "@/context/OSContext";
import { AdminProvider } from "@/context/AdminContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { SiteHeader } from "@/components/SiteHeader";

const wrap = (ui: React.ReactNode) =>
  render(
    <MemoryRouter>
      <ThemeProvider>
        <OSProvider>
          <AdminProvider>{ui}</AdminProvider>
        </OSProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );

const PickMac = () => {
  const { setOS } = useOS();
  return <button onClick={() => setOS("mac")}>pick</button>;
};

describe("SiteHeader", () => {
  it("renders a theme toggle on the OS-picker (no OS chosen)", () => {
    wrap(<SiteHeader />);
    // ThemeToggle exposes an aria-label that begins with "Theme:"
    const btn = screen.getByRole("button", { name: /^Theme:/ });
    expect(btn).toBeInTheDocument();
  });

  it("toggles theme via the header button", () => {
    wrap(<SiteHeader />);
    const btn = screen.getByRole("button", { name: /^Theme:/ });
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    act(() => { btn.click(); });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("renders full controls once an OS is picked", () => {
    wrap(<><PickMac /><SiteHeader /></>);
    act(() => { screen.getByText("pick").click(); });
    expect(screen.getByRole("button", { name: /^Theme:/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Search/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Settings/i })).toBeInTheDocument();
  });
});

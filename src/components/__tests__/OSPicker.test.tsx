import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { OSProvider } from "@/context/OSContext";
import { OSPicker } from "@/components/OSPicker";

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn() };
});

describe("OSPicker", () => {
  it("renders the rebrand string", () => {
    render(
      <MemoryRouter>
        <OSProvider><OSPicker /></OSProvider>
      </MemoryRouter>,
    );
    expect(screen.getByText(/ON-NEX TRAINING PORTAL/i)).toBeInTheDocument();
    expect(screen.queryByText(/VIBE CODING INCUBATOR/i)).toBeNull();
  });

  it("invokes choose handler without throwing", () => {
    render(
      <MemoryRouter>
        <OSProvider><OSPicker /></OSProvider>
      </MemoryRouter>,
    );
    const macBtn = screen.getByText(/macOS/i).closest("button")!;
    act(() => { macBtn.click(); });
    expect(localStorage.getItem("vci.os")).toBe("mac");
  });
});

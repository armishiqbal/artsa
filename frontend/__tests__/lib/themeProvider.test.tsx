import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { ThemeProvider, useTheme, THEME_STORAGE_KEY } from "@/lib/context/ThemeProvider";

/** Mock matchMedia — jsdom doesn't implement it. */
function mockMatchMedia(matches: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

function ThemeProbe() {
  const { theme, setTheme, toggleTheme } = useTheme();
  return (
    <div>
      <span data-testid="current-theme">{theme}</span>
      <button onClick={toggleTheme}>toggle</button>
      <button onClick={() => setTheme("dark")}>set-dark</button>
    </div>
  );
}

describe("ThemeProvider", () => {
  beforeEach(() => {
    localStorage.clear();
    delete document.documentElement.dataset.theme;
    document.documentElement.style.colorScheme = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults to the OS preference when nothing is stored", () => {
    mockMatchMedia(true); // system prefers light
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("reads a stored choice over the system preference", () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    mockMatchMedia(true); // system prefers light, but stored wins
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
  });

  it("toggles between themes and persists the choice", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "dark");
    mockMatchMedia(false);
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");

    await user.click(screen.getByText("toggle"));
    expect(screen.getByTestId("current-theme")).toHaveTextContent("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");

    await user.click(screen.getByText("toggle"));
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("setTheme switches to an explicit theme", async () => {
    localStorage.setItem(THEME_STORAGE_KEY, "light");
    mockMatchMedia(false);
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(screen.getByTestId("current-theme")).toHaveTextContent("light");

    await user.click(screen.getByText("set-dark"));
    expect(screen.getByTestId("current-theme")).toHaveTextContent("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
  });

  it("throws when used outside the provider", () => {
    mockMatchMedia(false);
    // Deliberately rendering the probe without a provider — useTheme throws.
    expect(() => render(<ThemeProbe />)).toThrow("useTheme must be used within <ThemeProvider>");
  });

  it("keeps the color-scheme style in sync", () => {
    mockMatchMedia(false); // dark
    render(
      <ThemeProvider>
        <ThemeProbe />
      </ThemeProvider>
    );
    expect(document.documentElement.style.colorScheme).toBe("dark");
  });
});

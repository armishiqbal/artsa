import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { UserProfileMenu } from "@/components/layout/UserProfileMenu";
import Sidebar from "@/components/layout/Sidebar";
import { ProfileHeroHUD } from "@/components/profile/ProfileHeroHUD";
import { useAuthStore } from "@/lib/stores/auth";

let currentPathname = "/command-center";
const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => currentPathname,
}));

vi.mock("@/lib/hooks/useAuthRole", () => ({
  useAuthRole: () => ({
    identity: {
      authenticated: true,
      role: "admin",
      user: {
        display_name: "Security Lead",
        email: "lead@artsa.sec",
        role: "admin",
        avatar: "🛡️",
      },
      capabilities: {
        can_ingest: true,
        can_run_campaigns: true,
        can_run_benchmark: true,
        can_run_ablation: true,
        can_manage_policies: true,
        can_manage_providers: true,
        can_manage_integrations: true,
        can_manage_targets: true,
        read_only: false,
      },
      auth_required: true,
    },
    capabilities: {
      can_ingest: true,
      can_run_campaigns: true,
      can_run_benchmark: true,
      can_run_ablation: true,
      can_manage_policies: true,
      can_manage_providers: true,
      can_manage_integrations: true,
      can_manage_targets: true,
      read_only: false,
    },
    loading: false,
  }),
}));

describe("UserProfileMenu direct link", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    currentPathname = "/command-center";
    useAuthStore.setState({
      bearerToken: "test-token",
      apiKey: "test-api-key",
      user: {
        display_name: "Security Lead",
        email: "lead@artsa.sec",
        role: "admin",
        avatar: "🛡️",
      },
    });
  });

  it("renders profile avatar, display name, and role/email as a direct link to /profile", () => {
    render(<UserProfileMenu />);
    const link = screen.getByRole("link", { name: /view account profile/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/profile");
    expect(screen.getByText("Security Lead")).toBeInTheDocument();
    expect(screen.getByText("lead@artsa.sec")).toBeInTheDocument();
    // Does NOT render any popover menu or dropdown
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("indicates active state when currently on /profile", () => {
    currentPathname = "/profile";
    render(<UserProfileMenu />);
    const link = screen.getByRole("link", { name: /view account profile/i });
    expect(link).toHaveAttribute("aria-current", "page");
    expect(link).toHaveClass("bg-muted");
  });

  it("calls onNavigate when clicked (e.g., in mobile drawer)", async () => {
    const onNavigateMock = vi.fn();
    render(<UserProfileMenu onNavigate={onNavigateMock} />);
    const link = screen.getByRole("link", { name: /view account profile/i });
    await userEvent.click(link);
    expect(onNavigateMock).toHaveBeenCalled();
  });

  it("renders chosen initial color theme in the bottom-left profile avatar", () => {
    useAuthStore.setState({
      user: {
        display_name: "Alice Smith",
        email: "alice@artsa.sec",
        role: "admin",
        avatar: "color:emerald",
      },
    });
    render(<UserProfileMenu />);
    // Renders initials "AL" matching display name
    expect(screen.getByText("AL")).toBeInTheDocument();
    // Resolves emerald preset color styling
    const monogram = screen.getByText("AL").closest("span");
    expect(monogram).toHaveStyle({ color: "#059669" });
  });
});

describe("Sidebar with UserProfileMenu", () => {
  it("renders the primary navigation items and anchors the profile direct link at the bottom", () => {
    currentPathname = "/command-center";
    render(<Sidebar />);
    expect(screen.getByText("Command Center")).toBeInTheDocument();
    const link = screen.getByRole("link", { name: /view account profile/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/profile");
  });
});

describe("Profile Page with Sign Out button", () => {
  it("renders Sign out button in ProfileHeroHUD and calls onSignOut", async () => {
    const onSignOutMock = vi.fn();
    render(
      <ProfileHeroHUD
        profile={{
          email: "lead@artsa.sec",
          display_name: "Security Lead",
          role: "admin",
          avatar: "🛡️",
          created_at: new Date().toISOString(),
          phone: null,
          location: null,
          organization: null,
        }}
        role="admin"
        method="password"
        displayNameValue="Security Lead"
        email="lead@artsa.sec"
        displayAvatar="🛡️"
        initialsLabel="SL"
        showEditable={true}
        editing={false}
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSignOut={onSignOutMock}
      />
    );

    const signOutBtn = screen.getByRole("button", { name: /sign out of account/i });
    expect(signOutBtn).toBeInTheDocument();
    await userEvent.click(signOutBtn);
    expect(onSignOutMock).toHaveBeenCalled();
  });
});

import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";
import CommandPalette from "@/components/CommandPalette";

/**
 * Authenticated app shell. Only pages under the (app) route group render the
 * sidebar / top nav / command palette — the login page (and other public
 * routes like /auth/callback) stay bare, so visitors see a clean login screen
 * instead of the product chrome they can't use yet.
 */
export default function AppShellLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopNav />
        <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl">{children}</div>
        </main>
      </div>
      <CommandPalette />
    </div>
  );
}

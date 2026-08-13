import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import Sidebar from "@/components/layout/Sidebar";
import TopNav from "@/components/layout/TopNav";
import CommandPalette from "@/components/CommandPalette";
import { ClientProviders } from "@/components/ClientProviders";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "ARTSA — Real-Time AI Containment & Escape Detection",
  description: "Enterprise AI agent containment, escape detection, and red-team observability",
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: "#0C1326",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} ${jetbrainsMono.variable} min-h-screen font-sans antialiased`}>
        <ClientProviders>
          <a
            href="#main-content"
            className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
          >
            Skip to main content
          </a>
          <div className="flex min-h-screen bg-background">
            <Sidebar />
            <div className="flex min-w-0 flex-1 flex-col">
              <TopNav />
              <main id="main-content" className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
                <div className="mx-auto max-w-7xl">{children}</div>
              </main>
            </div>
          </div>
          <CommandPalette />
        </ClientProviders>
      </body>
    </html>
  );
}

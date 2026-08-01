import type { Metadata } from 'next';
import Sidebar from '@/components/layout/Sidebar';
import TopNav from '@/components/layout/TopNav';
import './globals.css';

export const metadata: Metadata = {
  title: 'ARTSA — Real-Time AI Containment & Escape Detection',
  description: 'Datadog for AI Agent Escape Detection & Live Containment Monitoring',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0B0F19] text-[#F1F2F6] antialiased min-h-screen flex">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <TopNav />
          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}

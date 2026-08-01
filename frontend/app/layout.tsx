import './globals.css';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import CommandPalette from '@/components/CommandPalette';

export const metadata = {
  title: 'ARTSA — SOC AI Wargame & Security Mesh',
  description: 'Production-grade AI wargame framework for automated LLM security testing & evolutionary attacks.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-soc-bg text-soc-text min-h-screen flex antialiased">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Header />
          <main className="flex-1 p-6 overflow-y-auto">
            {children}
          </main>
        </div>
        <CommandPalette />
      </body>
    </html>
  );
}

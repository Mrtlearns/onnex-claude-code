import Sidebar from './Sidebar';
import Header from './Header';

interface AppShellProps {
  children: React.ReactNode;
}

export default function AppShell({ children }: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Fixed left sidebar — 220px wide */}
      <Sidebar />

      {/* Right column: header + scrollable content */}
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />

        {/* Main scrollable content area */}
        <main className="flex-1 overflow-y-auto p-6">
          {children}
        </main>
      </div>
    </div>
  );
}

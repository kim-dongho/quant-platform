import { SideNav } from '@/shared/ui/side-nav';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-background text-on-background flex min-h-screen antialiased">
      <SideNav />
      <main className="flex h-screen max-h-screen flex-1 flex-col overflow-hidden md:ml-60">
        {children}
      </main>
    </div>
  );
}

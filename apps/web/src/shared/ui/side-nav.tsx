'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/backtest', label: 'Backtest', icon: 'history_edu' },
  { href: '/portfolio', label: 'Portfolio', icon: 'pie_chart' },
  { href: '/trade', label: 'Trade', icon: 'bolt' },
];

export const SideNav = () => {
  const pathname = usePathname() ?? '';

  return (
    <aside className="fixed top-0 left-0 z-50 hidden h-full w-60 flex-col border-r border-slate-200 bg-slate-50 pt-4 md:flex">
      <div className="mt-2 mb-8 flex items-center justify-center gap-4 px-4">
        <Image src="/assets/logo.svg" alt="Quant Platform" width={36} height={36} priority />
        <h1 className="text-lg font-black tracking-tight text-blue-700 uppercase">
          Quant Platform
        </h1>
      </div>

      <nav className="flex flex-1 flex-col">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={[
                'm-2 flex items-center gap-3 rounded-lg px-4 py-3 text-left text-xs font-semibold tracking-wider uppercase transition-colors',
                isActive
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              <span
                className="material-symbols-outlined text-[20px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto border-t border-slate-200 p-4">
        <a
          href="https://github.com/kim-dongho/quant-platform"
          target="_blank"
          rel="noopener noreferrer"
          className="text-on-surface-variant hover:text-on-surface text-[11px] transition-colors"
        >
          © 2026 kim-dongho
        </a>
      </div>
    </aside>
  );
};

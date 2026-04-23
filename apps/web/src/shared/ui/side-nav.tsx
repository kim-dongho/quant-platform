'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface NavItem {
  href: string;
  label: string;
  desc: string;
  icon: string;
}

const NAV_ITEMS: NavItem[] = [
  { href: '/backtest', label: '차트', desc: '종목 차트 보기', icon: 'candlestick_chart' },
  { href: '/portfolio', label: '전략', desc: '조건 만들고 과거 검증', icon: 'rule' },
  {
    href: '/trade',
    label: '모의투자',
    desc: '가상 계좌로 매매',
    icon: 'account_balance_wallet',
  },
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
                'm-2 flex items-start gap-3 rounded-lg px-4 py-3 text-left transition-colors',
                isActive
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900',
              ].join(' ')}
            >
              <span
                className="material-symbols-outlined mt-0.5 text-[20px]"
                style={isActive ? { fontVariationSettings: "'FILL' 1" } : undefined}
              >
                {item.icon}
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="text-sm font-semibold">{item.label}</span>
                <span className="truncate text-[10px] font-normal text-slate-400">{item.desc}</span>
              </div>
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Home, Dumbbell, UtensilsCrossed, TrendingUp } from 'lucide-react';

const navItems = [
  { href: '/', icon: Home, label: '홈' },
  { href: '/workout', icon: Dumbbell, label: '운동' },
  { href: '/diet', icon: UtensilsCrossed, label: '식단' },
  { href: '/progress', icon: TrendingUp, label: '진행률' },
];

export default function Navigation() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-zinc-800 bg-zinc-950/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-lg items-center justify-around py-2">
        {navItems.map(({ href, icon: Icon, label }) => {
          const isActive = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-center gap-0.5 px-4 py-1 text-xs transition-colors ${
                isActive ? 'text-emerald-400' : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              <Icon className="h-6 w-6" />
              <span>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export const navGroups = [
  {
    title: 'Arbeit',
    items: [
      { href: '/dashboard', label: 'Dashboard' },
      { href: '/register', label: 'Register' },
      { href: '/priorities', label: 'Prioritäten' },
      { href: '/integrations', label: 'Integrationen' },
    ],
  },
  {
    title: 'Verwaltung',
    items: [
      { href: '/settings/assessment-model', label: 'Bewertungsmodell' },
      { href: '/settings/products', label: 'Produkte' },
      { href: '/settings/members', label: 'Rollen' },
      { href: '/settings/teams', label: 'Teams' },
      { href: '/settings/audit', label: 'Protokoll' },
    ],
  },
] as const;

export function SideNav({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Hauptnavigation">
      {navGroups.map((group) => (
        <div key={group.title}>
          <p className="nav-group-title" id={`nav-${group.title}`}>
            {group.title}
          </p>
          <ul className="nav-list" aria-labelledby={`nav-${group.title}`}>
            {group.items.map((item) => {
              const current = pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="nav-link"
                    aria-current={current ? 'page' : undefined}
                    onClick={onNavigate}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

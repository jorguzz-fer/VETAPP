'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PlatformAuthProvider, usePlatformAuth } from '@/providers/PlatformAuthProvider';

const PUBLIC = ['/plataforma/login'];

function PlatformShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { admin, loading, logout } = usePlatformAuth();

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!isPublic && !loading && !admin) router.replace('/plataforma/login');
  }, [isPublic, loading, admin, router]);

  if (isPublic) {
    return <main className="min-h-screen bg-gray-50 dark:bg-[#0a0e19]">{children}</main>;
  }
  if (loading || !admin) {
    return <div className="min-h-screen grid place-items-center text-gray-500">Carregando…</div>;
  }

  const nav = [
    { href: '/plataforma', label: 'Painel', icon: 'ri-dashboard-line' },
    { href: '/plataforma/planos', label: 'Planos', icon: 'ri-price-tag-3-line' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e19] text-black dark:text-white">
      <header className="bg-white dark:bg-[#0c1427] border-b border-gray-100 dark:border-[#172036] sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/plataforma" className="font-semibold flex items-center gap-2">
            <span className="inline-grid place-items-center w-7 h-7 rounded-md bg-primary-500 text-white text-sm">
              <i className="ri-shield-star-line"></i>
            </span>
            VETAPP <span className="text-gray-400 font-normal">· Plataforma</span>
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:inline">{admin.nome}</span>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500" title="Sair">
              <i className="ri-logout-box-r-line"></i>
            </button>
          </div>
        </div>
        <nav className="max-w-6xl mx-auto px-4 flex gap-1">
          {nav.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-2 text-sm border-b-2 -mb-px flex items-center gap-1.5 ${
                  active
                    ? 'border-primary-500 text-primary-500'
                    : 'border-transparent text-gray-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <i className={n.icon}></i> {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="max-w-6xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function PlataformaLayout({ children }: { children: ReactNode }) {
  return (
    <PlatformAuthProvider>
      <PlatformShell>{children}</PlatformShell>
    </PlatformAuthProvider>
  );
}

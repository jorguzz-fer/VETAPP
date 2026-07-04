'use client';

import { useEffect, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { PortalAuthProvider, usePortalAuth } from '@/providers/PortalAuthProvider';

// Rotas do portal que NÃO exigem sessão do tutor.
const PUBLIC = ['/portal/login', '/portal/convite'];

function PortalShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tutor, loading, logout } = usePortalAuth();

  const isPublic = PUBLIC.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  useEffect(() => {
    if (!isPublic && !loading && !tutor) {
      router.replace('/portal/login');
    }
  }, [isPublic, loading, tutor, router]);

  if (isPublic) {
    return <main className="min-h-screen bg-gray-50 dark:bg-[#0a0e19]">{children}</main>;
  }

  if (loading || !tutor) {
    return <div className="min-h-screen grid place-items-center text-gray-500">Carregando…</div>;
  }

  const nav = [
    { href: '/portal', label: 'Início', icon: 'ri-home-5-line' },
    { href: '/portal/agendamentos', label: 'Agenda', icon: 'ri-calendar-line' },
    { href: '/portal/faturas', label: 'Faturas', icon: 'ri-bill-line' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0e19] text-black dark:text-white">
      <header className="bg-white dark:bg-[#0c1427] border-b border-gray-100 dark:border-[#172036] sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/portal" className="font-semibold flex items-center gap-2">
            <i className="ri-paw-print-fill text-primary-500"></i> {tutor.clinicaNome}
          </Link>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-500 hidden sm:inline">Olá, {tutor.nome.split(' ')[0]}</span>
            <button onClick={logout} className="text-sm text-gray-500 hover:text-red-500" title="Sair">
              <i className="ri-logout-box-r-line"></i>
            </button>
          </div>
        </div>
        <nav className="max-w-3xl mx-auto px-4 flex gap-1">
          {nav.map((n) => {
            const active = pathname === n.href;
            return (
              <Link
                key={n.href}
                href={n.href}
                className={`px-3 py-2 text-sm border-b-2 -mb-px ${
                  active
                    ? 'border-primary-500 text-primary-500'
                    : 'border-transparent text-gray-500 hover:text-black dark:hover:text-white'
                }`}
              >
                <i className={`${n.icon} mr-1`}></i>
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="max-w-3xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}

export default function PortalLayout({ children }: { children: ReactNode }) {
  return (
    <PortalAuthProvider>
      <PortalShell>{children}</PortalShell>
    </PortalAuthProvider>
  );
}

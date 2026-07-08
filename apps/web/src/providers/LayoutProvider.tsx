'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import { useAuth } from '@/providers/AuthProvider';

// Rotas que NÃO usam o shell (sidebar/header) — auth, telas públicas etc.
const BARE_ROUTES = ['/login', '/cadastro', '/recuperar-senha'];

/**
 * Shell de navegação do VETAPP. Estrutura herdada do Trezo (main-content-wrap →
 * sidebar-area + header-area + main-content), com componentes próprios.
 */
export default function LayoutProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [active, setActive] = useState(false);
  const toggleActive = () => setActive((v) => !v);

  // O portal do tutor (/portal/*) e o back-office da plataforma (/plataforma/*) têm
  // shell e auth próprios (PortalAuthProvider / PlatformAuthProvider) e o site público
  // (/clinica/*) é anônimo — nenhum usa o shell/guard da gestão.
  const isBare =
    BARE_ROUTES.includes(pathname) ||
    pathname.startsWith('/portal') ||
    pathname.startsWith('/plataforma') ||
    pathname.startsWith('/clinica/');

  // Guarda de rota (scaffold): sem usuário em rota protegida → login.
  // A autorização real é sempre server-side (docs/spec/02); isto é só UX.
  useEffect(() => {
    if (!isBare && !loading && !user) {
      router.replace('/login');
    }
  }, [isBare, loading, user, router]);

  if (isBare) {
    return <main className="min-h-screen">{children}</main>;
  }

  if (loading || !user) {
    return <div className="min-h-screen grid place-items-center text-gray-500">Carregando…</div>;
  }

  return (
    <div className={`main-content-wrap transition-all ${active ? 'active' : ''}`}>
      <Sidebar toggleActive={toggleActive} />
      <Header toggleActive={toggleActive} />
      <div className="main-content transition-all flex flex-col overflow-hidden min-h-screen">
        {children}
        <Footer />
      </div>
    </div>
  );
}

'use client';

import { useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

// Rotas que NÃO usam o shell (sidebar/header) — auth, telas públicas etc.
const BARE_ROUTES = ['/login', '/cadastro', '/recuperar-senha'];

/**
 * Shell de navegação do VETAPP. Estrutura herdada do Trezo (main-content-wrap →
 * sidebar-area + header-area + main-content), com componentes próprios.
 */
export default function LayoutProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [active, setActive] = useState(false);
  const toggleActive = () => setActive((v) => !v);

  const isBare = BARE_ROUTES.includes(pathname);

  if (isBare) {
    return <main className="min-h-screen">{children}</main>;
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

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { navSections } from '@/lib/nav';

interface SidebarProps {
  toggleActive: () => void;
}

/**
 * Sidebar do VETAPP. Reusa as classes de layout do Trezo (.sidebar-area, definida
 * em globals.css), mas com o menu próprio por domínio/persona (docs/spec/07) — não
 * o menu de demos do template.
 */
export default function Sidebar({ toggleActive }: SidebarProps) {
  const pathname = usePathname();

  return (
    <aside className="sidebar-area bg-white dark:bg-[#0c1427] fixed z-[7] top-0 h-screen transition-all overflow-y-auto">
      <div className="flex items-center justify-between px-[25px] h-[70px] sticky top-0 bg-white dark:bg-[#0c1427] z-10">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold text-lg text-black dark:text-white">
          <span className="inline-grid place-items-center w-8 h-8 rounded-md bg-primary-500 text-white">
            <i className="ri-heart-pulse-line"></i>
          </span>
          VETAPP
        </Link>
        <button type="button" onClick={toggleActive} className="burger-menu xl:hidden text-black dark:text-white" aria-label="Fechar menu">
          <i className="ri-close-line text-2xl"></i>
        </button>
      </div>

      <nav className="px-[15px] pb-10">
        {navSections.map((section) => (
          <div key={section.title} className="mt-5">
            <p className="text-xs uppercase tracking-wide text-gray-400 px-[10px] mb-2">{section.title}</p>
            <ul className="flex flex-col gap-1">
              {section.items.map((item) => {
                const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-2.5 rounded-md px-[10px] py-2 text-[14px] transition-all ${
                        active
                          ? 'bg-primary-500 text-white'
                          : 'text-black dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#15203c]'
                      }`}
                    >
                      <i className={`${item.icon} text-[18px]`}></i>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </aside>
  );
}

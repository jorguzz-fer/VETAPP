'use client';

interface HeaderProps {
  toggleActive: () => void;
}

/**
 * Header do VETAPP. Reusa a classe .header-area do Trezo (globals.css). Versão
 * inicial enxuta — busca, perfil e ações entram conforme os módulos (docs/spec/05).
 */
export default function Header({ toggleActive }: HeaderProps) {
  return (
    <header className="header-area bg-white dark:bg-[#0c1427] fixed z-[6] top-0 h-[65px] rounded-b-md shadow-sm flex items-center justify-between px-[20px] transition-all">
      <div className="flex items-center gap-3">
        <button type="button" onClick={toggleActive} className="text-black dark:text-white xl:hidden" aria-label="Abrir menu">
          <i className="ri-menu-2-line text-2xl"></i>
        </button>
        <div className="hidden md:flex items-center gap-2 bg-gray-50 dark:bg-[#15203c] rounded-md px-3 py-2 w-[280px]">
          <i className="ri-search-line text-gray-400"></i>
          <input
            type="search"
            placeholder="Buscar cliente, animal, telefone…"
            className="bg-transparent outline-none text-sm w-full text-black dark:text-white"
          />
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button type="button" className="relative text-black dark:text-white" aria-label="Notificações">
          <i className="ri-notification-2-line text-xl"></i>
          <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-primary-500"></span>
        </button>
        <div className="flex items-center gap-2">
          <span className="inline-grid place-items-center w-9 h-9 rounded-full bg-primary-100 text-primary-700 font-semibold">
            V
          </span>
          <span className="hidden md:block text-sm text-black dark:text-white">Minha conta</span>
        </div>
      </div>
    </header>
  );
}

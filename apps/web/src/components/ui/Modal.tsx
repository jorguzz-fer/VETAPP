'use client';

import { type ReactNode, useEffect } from 'react';

/** Modal simples e acessível: backdrop clicável, fecha no Esc, painel centralizado. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-lg border border-gray-100 bg-white p-5 shadow-xl dark:border-[#172036] dark:bg-[#0c1427]">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-black dark:text-white">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
          >
            <i className="ri-close-line text-xl"></i>
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

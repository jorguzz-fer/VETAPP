import type { ReactNode } from 'react';

interface CardProps {
  children: ReactNode;
  className?: string;
}

/**
 * Card base do design system. Encapsula o estilo do template (trezo-card) para
 * podermos evoluir sem reescrever telas (docs/spec/10 §3).
 */
export function Card({ children, className = '' }: CardProps) {
  return (
    <div className={`trezo-card bg-white dark:bg-[#0c1427] rounded-md p-[20px] md:p-[25px] shadow-sm ${className}`}>
      {children}
    </div>
  );
}

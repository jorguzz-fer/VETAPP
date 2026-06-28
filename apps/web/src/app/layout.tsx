import 'material-symbols';
import 'remixicon/fonts/remixicon.css';
import './globals.css';

import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import LayoutProvider from '@/providers/LayoutProvider';

const inter = Inter({ variable: '--font-body', subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'VETAPP',
  description: 'Plataforma de gestão para clínicas veterinárias',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" dir="ltr">
      <body className={`${inter.variable} antialiased`}>
        <LayoutProvider>{children}</LayoutProvider>
      </body>
    </html>
  );
}

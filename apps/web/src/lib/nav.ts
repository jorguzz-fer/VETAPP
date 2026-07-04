// Menu do VETAPP organizado por domínio. A "visão por perfil/login" (docs/spec/07)
// filtra os itens conforme o papel — aqui ficam todos; o filtro entra com a auth.

export interface NavItem {
  label: string;
  href: string;
  icon: string; // classe remixicon (ri-*)
  roles?: string[]; // papéis que enxergam o item (vazio = todos)
}

export interface NavSection {
  title: string;
  items: NavItem[];
}

export const navSections: NavSection[] = [
  {
    title: 'Geral',
    items: [
      { label: 'Início', href: '/dashboard', icon: 'ri-home-5-line' },
      { label: 'Agenda', href: '/agenda', icon: 'ri-calendar-2-line' },
    ],
  },
  {
    title: 'Clínico',
    items: [
      { label: 'Clientes & Animais', href: '/clientes', icon: 'ri-user-heart-line' },
      { label: 'Prontuário', href: '/prontuario', icon: 'ri-stethoscope-line' },
      { label: 'Internação', href: '/internacao', icon: 'ri-hospital-line', roles: ['admin', 'veterinario', 'internacao'] },
    ],
  },
  {
    title: 'Comercial',
    items: [
      { label: 'Orçamentos', href: '/orcamentos', icon: 'ri-file-list-3-line' },
      { label: 'Faturas', href: '/faturas', icon: 'ri-bill-line' },
      { label: 'Tabela de preços', href: '/precos', icon: 'ri-price-tag-3-line' },
      { label: 'Estoque', href: '/estoque', icon: 'ri-archive-2-line' },
      { label: 'Comissões', href: '/comissoes', icon: 'ri-hand-coin-line' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { label: 'Produtividade', href: '/produtividade', icon: 'ri-line-chart-line', roles: ['admin', 'gestor'] },
      { label: 'Cadastros', href: '/cadastros', icon: 'ri-archive-line' },
      { label: 'Configurações', href: '/configuracoes', icon: 'ri-settings-3-line', roles: ['admin'] },
    ],
  },
];

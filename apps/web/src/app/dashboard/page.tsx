import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

// Página de exemplo demonstrando o shell + design system (base visual Trezo).
// A home real será "por persona" (docs/spec/00 §3) nas próximas iterações.

const kpis = [
  { label: 'Animais ativos', value: '1.284', icon: 'ri-bear-smile-line' },
  { label: 'Atendimentos (24h)', value: '37', icon: 'ri-stethoscope-line' },
  { label: 'Venda líq./mês', value: 'R$ 84.2k', icon: 'ri-money-dollar-circle-line' },
  { label: 'Internados agora', value: '6', icon: 'ri-hospital-line' },
];

export default function DashboardPage() {
  return (
    <div className="flex flex-col gap-[25px]">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-black dark:text-white">Início</h1>
          <p className="text-sm text-gray-500">Visão geral da clínica</p>
        </div>
        <Button>
          <i className="ri-add-line"></i> Novo atendimento
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-[25px]">
        {kpis.map((kpi) => (
          <Card key={kpi.label}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">{kpi.label}</p>
                <p className="text-2xl font-bold text-black dark:text-white mt-1">{kpi.value}</p>
              </div>
              <span className="inline-grid place-items-center w-12 h-12 rounded-md bg-primary-50 text-primary-500">
                <i className={`${kpi.icon} text-2xl`}></i>
              </span>
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <h2 className="text-lg font-semibold text-black dark:text-white mb-2">Bem-vindo ao VETAPP</h2>
        <p className="text-sm text-gray-500">
          Scaffold do front com a base visual Trezo (React/Next + Tailwind) e o design system
          próprio. Os módulos (prontuário, agenda, internação…) entram nas próximas iterações,
          conforme a SPEC em <code>docs/spec/</code>.
        </p>
      </Card>
    </div>
  );
}

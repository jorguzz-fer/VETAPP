'use client';

import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

interface Acesso {
  status: string;
  email: string | null;
  inviteExpiresAt: string | null;
  lastLoginAt: string | null;
}

const STATUS_LABEL: Record<string, { text: string; cls: string }> = {
  'sem-acesso': { text: 'Sem acesso', cls: 'bg-gray-100 dark:bg-[#15203c] text-gray-500' },
  invited: { text: 'Convite pendente', cls: 'bg-amber-50 text-amber-600' },
  active: { text: 'Ativo', cls: 'bg-green-50 text-green-600' },
  disabled: { text: 'Revogado', cls: 'bg-gray-100 dark:bg-[#15203c] text-gray-500' },
};

// Gestão do acesso do tutor ao portal do cliente (doc 13 §5). A clínica gera o
// link de convite; o tutor cria a própria senha. Nenhuma senha trafega aqui.
export function PortalAcessoCard({ responsavelId }: { responsavelId: string }) {
  const [acesso, setAcesso] = useState<Acesso | null>(null);
  const [link, setLink] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    const { data } = await api.GET('/api/clientes/{responsavelId}/portal', {
      params: { path: { responsavelId } },
    });
    setAcesso((data as Acesso) ?? null);
  }, [responsavelId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function gerarConvite() {
    setBusy(true);
    setLink(null);
    setCopied(false);
    const { data, error } = await api.POST('/api/clientes/{responsavelId}/portal/convite', {
      params: { path: { responsavelId } },
    });
    setBusy(false);
    if (error || !data) {
      alert('Não foi possível gerar o convite.');
      return;
    }
    const url = `${window.location.origin}/portal/convite?token=${data.token}&t=${data.tenantId}`;
    setLink(url);
    void load();
  }

  async function revogar() {
    if (!confirm('Revogar o acesso deste tutor ao portal?')) return;
    setBusy(true);
    await api.POST('/api/clientes/{responsavelId}/portal/revogar', { params: { path: { responsavelId } } });
    setBusy(false);
    setLink(null);
    void load();
  }

  function copiar() {
    if (!link) return;
    void navigator.clipboard?.writeText(link);
    setCopied(true);
  }

  const status = acesso?.status ?? 'sem-acesso';
  const badge = STATUS_LABEL[status] ?? STATUS_LABEL['sem-acesso'];

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold text-black dark:text-white">
            <i className="ri-global-line mr-1 text-primary-500"></i> Portal do tutor
          </h2>
          <p className="text-sm text-gray-500">
            Acesso do cliente à área logada (pets, agenda e faturas).
          </p>
        </div>
        <span className={`text-xs rounded-full px-3 py-1 ${badge.cls}`}>{badge.text}</span>
      </div>

      <div className="flex flex-wrap items-center gap-2 mt-4">
        {status === 'active' ? (
          <>
            <Button variant="ghost" onClick={gerarConvite} disabled={busy}>
              <i className="ri-refresh-line"></i> Reenviar convite
            </Button>
            <Button variant="ghost" onClick={revogar} disabled={busy}>
              <i className="ri-forbid-line"></i> Revogar acesso
            </Button>
          </>
        ) : status === 'invited' ? (
          <>
            <Button variant="ghost" onClick={gerarConvite} disabled={busy}>
              <i className="ri-refresh-line"></i> Gerar novo link
            </Button>
            <Button variant="ghost" onClick={revogar} disabled={busy}>
              <i className="ri-forbid-line"></i> Cancelar convite
            </Button>
          </>
        ) : (
          <Button onClick={gerarConvite} disabled={busy}>
            <i className="ri-mail-send-line"></i> {busy ? 'Gerando…' : 'Convidar para o portal'}
          </Button>
        )}
      </div>

      {link && (
        <div className="mt-4 rounded-md border border-gray-100 dark:border-[#172036] p-3">
          <p className="text-xs text-gray-500 mb-2">
            Envie este link ao tutor (válido por 7 dias). Ele cria a própria senha ao abrir.
          </p>
          <div className="flex gap-2">
            <input
              readOnly
              value={link}
              onFocus={(e) => e.target.select()}
              className="flex-1 text-xs rounded-md border border-gray-200 dark:border-[#172036] bg-gray-50 dark:bg-[#0c1427] px-2 py-1.5"
            />
            <Button variant="ghost" onClick={copiar}>
              <i className="ri-file-copy-line"></i> {copied ? 'Copiado' : 'Copiar'}
            </Button>
          </div>
        </div>
      )}

      {status === 'active' && acesso?.lastLoginAt && (
        <p className="text-xs text-gray-400 mt-3">
          Último acesso: {new Date(acesso.lastLoginAt).toLocaleString('pt-BR')}
        </p>
      )}
    </Card>
  );
}

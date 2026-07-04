'use client';

import { use, useEffect, useState, type FormEvent } from 'react';
import { api } from '@/lib/api';

interface PublicSite {
  slug: string;
  nomeExibicao?: string | null;
  sobre?: string | null;
  servicos: string[];
  endereco?: string | null;
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  horario?: string | null;
  corPrimaria?: string | null;
  logoUrl?: string | null;
}

const emptyForm = {
  nome: '',
  telefone: '',
  email: '',
  petNome: '',
  servicoDesejado: '',
  preferencia: '',
  mensagem: '',
  origem: '',
  website: '', // honeypot
};

export default function ClinicaPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const [site, setSite] = useState<PublicSite | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data, error } = await api.GET('/api/public/clinica/{slug}', { params: { path: { slug } } });
      if (error || !data) setNotFound(true);
      else setSite(data);
      setLoading(false);
    })();
  }, [slug]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSending(true);
    const { error } = await api.POST('/api/public/clinica/{slug}/agendamento', {
      params: { path: { slug } },
      body: {
        nome: form.nome,
        telefone: form.telefone,
        email: form.email || undefined,
        petNome: form.petNome || undefined,
        servicoDesejado: form.servicoDesejado || undefined,
        preferencia: form.preferencia || undefined,
        mensagem: form.mensagem || undefined,
        origem: form.origem || undefined,
        website: form.website || undefined,
      },
    });
    setSending(false);
    if (error) {
      setError('Não foi possível enviar agora. Tente novamente em instantes.');
      return;
    }
    setSent(true);
    setForm(emptyForm);
  }

  if (loading) return <div className="min-h-screen grid place-items-center text-gray-500">Carregando…</div>;
  if (notFound || !site)
    return (
      <div className="min-h-screen grid place-items-center px-4 text-center">
        <div>
          <i className="ri-error-warning-line text-4xl text-gray-400"></i>
          <p className="text-gray-500 mt-2">Página não encontrada.</p>
        </div>
      </div>
    );

  const cor = site.corPrimaria || '#605dff';
  const nome = site.nomeExibicao || 'Clínica Veterinária';
  const inputCls =
    'w-full rounded-md border border-gray-200 bg-white px-3 py-2 outline-none focus:border-gray-400 text-sm';

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="text-white" style={{ backgroundColor: cor }}>
        <div className="max-w-3xl mx-auto px-4 py-10 flex items-center gap-4">
          {site.logoUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={site.logoUrl} alt={nome} className="w-16 h-16 rounded-full object-cover bg-white/20" />
          )}
          <div>
            <h1 className="text-2xl font-semibold">{nome}</h1>
            {site.horario && <p className="text-white/80 text-sm mt-1">{site.horario}</p>}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-8 flex flex-col gap-8">
        {site.sobre && (
          <section>
            <h2 className="text-lg font-semibold mb-2">Sobre</h2>
            <p className="text-gray-600 whitespace-pre-line">{site.sobre}</p>
          </section>
        )}

        {site.servicos.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-2">Serviços</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {site.servicos.map((s) => (
                <li key={s} className="flex items-center gap-2 text-gray-700">
                  <i className="ri-checkbox-circle-line" style={{ color: cor }}></i>
                  {s}
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="grid sm:grid-cols-3 gap-3 text-sm">
          {site.endereco && <Info icon="ri-map-pin-line" text={site.endereco} />}
          {site.telefone && <Info icon="ri-phone-line" text={site.telefone} />}
          {site.whatsapp && <Info icon="ri-whatsapp-line" text={site.whatsapp} />}
          {site.email && <Info icon="ri-mail-line" text={site.email} />}
        </section>

        <section className="bg-white rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold mb-1">Solicitar agendamento</h2>
          <p className="text-sm text-gray-500 mb-4">
            Envie seus dados e a clínica confirma o melhor horário com você.
          </p>
          {sent ? (
            <div className="text-center py-6">
              <i className="ri-checkbox-circle-fill text-4xl" style={{ color: cor }}></i>
              <p className="text-gray-700 mt-2">Solicitação enviada! A clínica entrará em contato.</p>
              <button onClick={() => setSent(false)} className="text-sm mt-3 underline" style={{ color: cor }}>
                Enviar outra
              </button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {error && <p className="sm:col-span-2 text-sm text-red-500">{error}</p>}
              <input required placeholder="Seu nome*" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} className={inputCls} />
              <input required placeholder="Telefone/WhatsApp*" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} className={inputCls} />
              <input type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className={inputCls} />
              <input placeholder="Nome do pet" value={form.petNome} onChange={(e) => setForm({ ...form, petNome: e.target.value })} className={inputCls} />
              <input placeholder="Serviço desejado" value={form.servicoDesejado} onChange={(e) => setForm({ ...form, servicoDesejado: e.target.value })} className={inputCls} />
              <input placeholder="Preferência de dia/horário" value={form.preferencia} onChange={(e) => setForm({ ...form, preferencia: e.target.value })} className={inputCls} />
              <textarea placeholder="Mensagem (opcional)" value={form.mensagem} onChange={(e) => setForm({ ...form, mensagem: e.target.value })} className={`${inputCls} sm:col-span-2`} rows={3} />
              <input placeholder="Como nos conheceu?" value={form.origem} onChange={(e) => setForm({ ...form, origem: e.target.value })} className={`${inputCls} sm:col-span-2`} />
              {/* Honeypot: oculto para humanos; bots preenchem. */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                value={form.website}
                onChange={(e) => setForm({ ...form, website: e.target.value })}
                className="hidden"
                aria-hidden="true"
              />
              <div className="sm:col-span-2">
                <button
                  type="submit"
                  disabled={sending}
                  className="rounded-md px-5 py-2 text-sm font-medium text-white disabled:opacity-60"
                  style={{ backgroundColor: cor }}
                >
                  {sending ? 'Enviando…' : 'Enviar solicitação'}
                </button>
              </div>
            </form>
          )}
        </section>
      </main>

      <footer className="text-center text-xs text-gray-400 py-6">{nome}</footer>
    </div>
  );
}

function Info({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-2 text-gray-600">
      <i className={icon}></i>
      <span>{text}</span>
    </div>
  );
}

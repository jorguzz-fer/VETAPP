'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function CadastroPage() {
  const router = useRouter();
  const { register } = useAuth();
  const [tenantName, setTenantName] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await register({ tenantName, name, email, password });
      router.push('/dashboard');
    } catch {
      setError('Não foi possível criar a conta. Verifique os dados (e-mail já em uso?).');
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500';

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 dark:bg-[#0a0e19] px-4 py-8">
      <Card className="w-full max-w-[440px]">
        <div className="flex items-center gap-2 font-bold text-lg text-black dark:text-white mb-1">
          <span className="inline-grid place-items-center w-8 h-8 rounded-md bg-primary-500 text-white">
            <i className="ri-heart-pulse-line"></i>
          </span>
          VETAPP
        </div>
        <p className="text-sm text-gray-500 mb-5">Crie sua clínica e a conta de administrador</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Nome da clínica</span>
            <input required value={tenantName} onChange={(e) => setTenantName(e.target.value)} className={inputCls} placeholder="Clínica Cuidar" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Seu nome</span>
            <input required value={name} onChange={(e) => setName(e.target.value)} className={inputCls} placeholder="Maria Silva" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">E-mail</span>
            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} placeholder="voce@clinica.com" />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Senha</span>
            <input type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} placeholder="mínimo 8 caracteres" />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Criando…' : 'Criar conta'}
          </Button>
        </form>

        <p className="text-sm text-gray-500 mt-4 text-center">
          Já tem conta?{' '}
          <Link href="/login" className="text-primary-500 hover:underline">Entrar</Link>
        </p>
      </Card>
    </div>
  );
}

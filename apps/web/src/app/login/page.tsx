'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/providers/AuthProvider';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      router.push('/dashboard');
    } catch {
      setError('E-mail ou senha inválidos.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-gray-50 dark:bg-[#0a0e19] px-4">
      <Card className="w-full max-w-[400px]">
        <div className="flex items-center gap-2 font-bold text-lg text-black dark:text-white mb-1">
          <span className="inline-grid place-items-center w-8 h-8 rounded-md bg-primary-500 text-white">
            <i className="ri-heart-pulse-line"></i>
          </span>
          VETAPP
        </div>
        <p className="text-sm text-gray-500 mb-5">Entre com sua conta</p>

        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">E-mail</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
              placeholder="voce@clinica.com"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-gray-600 dark:text-gray-300">Senha</span>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="rounded-md border border-gray-200 dark:border-[#172036] bg-white dark:bg-[#0c1427] px-3 py-2 outline-none focus:border-primary-500"
              placeholder="••••••••"
            />
          </label>

          {error && <p className="text-sm text-red-500">{error}</p>}

          <Button type="submit" disabled={submitting}>
            {submitting ? 'Entrando…' : 'Entrar'}
          </Button>
        </form>

        <p className="text-sm text-gray-500 mt-4 text-center">
          Não tem conta?{' '}
          <Link href="/cadastro" className="text-primary-500 hover:underline">Criar clínica</Link>
        </p>
      </Card>
    </div>
  );
}

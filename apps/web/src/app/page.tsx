import { redirect } from 'next/navigation';

// A home depende da persona (docs/spec/00 §3). Por ora, redireciona ao dashboard.
export default function Home() {
  redirect('/dashboard');
}

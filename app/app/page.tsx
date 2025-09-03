import { redirect } from 'next/navigation';
import { getServerAuthSession } from '../lib/auth';

export default async function Home() {
  const session = await getServerAuthSession();
  redirect(session ? '/dashboard' : '/login');
}


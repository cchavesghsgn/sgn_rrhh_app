
import { getServerAuthSession } from '../lib/auth';
import { redirect } from 'next/navigation';

export default async function HomePage() {
  const session = await getServerAuthSession();
  
  if (session) {
    redirect('/dashboard');
  } else {
    redirect('/login');
  }
}


import { getServerAuthSession } from '../../../lib/auth';
import { redirect } from 'next/navigation';
import Header from '../../../components/header';

export default async function AdminAreasPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  if (session.user.role !== 'ADMIN') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-sgn-dark mb-2">
            Gestión de Áreas
          </h1>
          <p className="text-gray-600">
            Funcionalidad en desarrollo
          </p>
        </div>
      </main>
    </div>
  );
}

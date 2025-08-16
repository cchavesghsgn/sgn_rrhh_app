
import { getServerAuthSession } from '../../lib/auth';
import { redirect } from 'next/navigation';
import Header from '../../components/header';
import RequestsList from '../../components/requests-list';

export default async function RequestsPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-sgn-dark mb-2">
            Mis Solicitudes
          </h1>
          <p className="text-gray-600">
            Visualiza y gestiona tus solicitudes de permisos
          </p>
        </div>
        <RequestsList />
      </main>
    </div>
  );
}

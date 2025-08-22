
import { getServerAuthSession } from '../../../lib/auth';
import { redirect } from 'next/navigation';
import Header from '../../../components/header';
import NewRequestForm from '../../../components/new-request-form';

export default async function NewRequestPage() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-sgn-dark mb-2">
            Nueva Solicitud
          </h1>
          <p className="text-gray-600">
            Completa el formulario para solicitar un permiso
          </p>
        </div>
        <NewRequestForm />
      </main>
    </div>
  );
}

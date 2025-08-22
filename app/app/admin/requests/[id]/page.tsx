
import { getServerAuthSession } from '../../../../lib/auth';
import { redirect } from 'next/navigation';
import Header from '../../../../components/header';
import RequestDetailView from '../../../../components/request-detail-view';

export default async function RequestDetailPage({ params }: { params: { id: string } }) {
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
      <main className="container max-w-4xl mx-auto px-4 py-8">
        <RequestDetailView requestId={params.id} />
      </main>
    </div>
  );
}

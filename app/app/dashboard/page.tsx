
import { getServerAuthSession } from '../../lib/auth';
import { redirect } from 'next/navigation';
import Header from '../../components/header';
import EmployeeDashboard from '../../components/employee-dashboard';
import AdminDashboard from '../../components/admin-dashboard';

export default async function Dashboard() {
  const session = await getServerAuthSession();

  if (!session) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      <main className="container max-w-6xl mx-auto px-4 py-8">
        {session.user.role === 'ADMIN' ? (
          <AdminDashboard />
        ) : (
          <EmployeeDashboard />
        )}
      </main>
    </div>
  );
}

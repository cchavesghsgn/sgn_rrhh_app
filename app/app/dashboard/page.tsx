
import { getServerAuthSession } from '../../lib/auth';
import { redirect } from 'next/navigation';
import Header from '../../components/header';
import EmployeeDashboard from '../../components/employee-dashboard';
import AdminDashboard from '../../components/admin-dashboard';

export default async function Dashboard() {
  console.log('🏠 Dashboard: Starting authentication check...');
  
  const session = await getServerAuthSession();
  
  console.log('🏠 Dashboard session check:', { 
    hasSession: !!session, 
    userId: session?.user?.id,
    userRole: session?.user?.role,
    userEmail: session?.user?.email,
    expires: session?.expires
  });

  if (!session) {
    console.log('❌ Dashboard: No session found, redirecting to login');
    redirect('/login');
  }
  
  console.log('✅ Dashboard: Session valid, rendering dashboard');

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

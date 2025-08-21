
'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from './ui/button';
import { 
  User, 
  LogOut, 
  Settings,
  Users,
  FileText,
  Home,
  Building2,
  ArrowLeft,
  Menu
} from 'lucide-react';

export default function Header() {
  const { data: session } = useSession();
  const router = useRouter();
  const pathname = usePathname();

  const handleLogout = async () => {
    try {
      await signOut({ redirect: false });
      router.push('/login');
      router.refresh();
    } catch (error) {
      console.error('Logout error:', error);
      // Fallback: force reload to clear any cached state
      window.location.href = '/login';
    }
  };

  const getBackPath = () => {
    if (pathname?.includes('/admin/employees/')) return '/admin/employees';
    if (pathname?.includes('/admin/areas/')) return '/admin/areas';
    if (pathname?.includes('/admin/')) return '/dashboard';
    if (pathname?.includes('/requests/')) return '/requests';
    return '/dashboard';
  };

  const shouldShowBackButton = () => {
    return pathname && pathname !== '/dashboard' && pathname !== '/login';
  };

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="container max-w-6xl mx-auto">
        <div className="flex h-24 items-center justify-between px-4">
          {/* Mobile Back Button */}
          {shouldShowBackButton() && (
            <div className="md:hidden">
              <Link href={getBackPath()}>
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-5 w-5" />
                </Button>
              </Link>
            </div>
          )}
          
          {/* Logo */}

          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="relative w-72 sm:w-96 h-20 sm:h-24">
                <Image
                    src="/sgn-logo-new.png"
                    alt="SGN Logo - Soluciones de Negocios"
                    fill
                    className="object-contain"
                    priority
                />
            </div>
          </Link>

          {/* Navigation */}
          {session && (
            <nav className="hidden md:flex items-center space-x-6">
              <Link
                href="/dashboard"
                className="flex items-center space-x-2 text-gray-600 hover:text-sgn-blue transition-colors"
              >
                <Home className="h-4 w-4" />
                <span>Dashboard</span>
              </Link>

              <Link
                href="/requests"
                className="flex items-center space-x-2 text-gray-600 hover:text-sgn-blue transition-colors"
              >
                <FileText className="h-4 w-4" />
                <span>Mis Solicitudes</span>
              </Link>

              {session.user.role === 'ADMIN' && (
                <>
                  <Link
                    href="/admin/employees"
                    className="flex items-center space-x-2 text-gray-600 hover:text-sgn-blue transition-colors"
                  >
                    <Users className="h-4 w-4" />
                    <span>Empleados</span>
                  </Link>

                  <Link
                    href="/admin/areas"
                    className="flex items-center space-x-2 text-gray-600 hover:text-sgn-blue transition-colors"
                  >
                    <Building2 className="h-4 w-4" />
                    <span>Áreas</span>
                  </Link>
                </>
              )}
            </nav>
          )}

          {/* User Menu */}
          {session && (
            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-medium text-gray-900">
                  {session.user.name}
                </span>
                <span className="text-xs text-gray-500">
                  {session.user.role === 'ADMIN' ? 'Administrador' : 'Empleado'}
                </span>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={handleLogout}
                className="text-gray-600 hover:text-red-600"
              >
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:ml-2 sm:inline">Salir</span>
              </Button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

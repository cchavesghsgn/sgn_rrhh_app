
'use client';

import { useSession, signOut } from 'next-auth/react';
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
  Building2
} from 'lucide-react';

export default function Header() {
  const { data: session } = useSession();

  return (
    <header className="sticky top-0 z-50 w-full bg-white/80 backdrop-blur-md border-b border-gray-200">
      <div className="container max-w-6xl mx-auto">
        <div className="flex h-20 items-center justify-between px-4">
          {/* Logo */}
          <Link href="/dashboard" className="flex items-center space-x-3">
            <div className="relative w-48 h-12">
              <Image
                src="/sgn-logo.png"
                alt="SGN Logo"
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
                onClick={() => signOut({ callbackUrl: '/login' })}
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

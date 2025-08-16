
import { getServerAuthSession } from '../../lib/auth';
import { redirect } from 'next/navigation';
import LoginForm from './login-form';
import Image from 'next/image';

export default async function LoginPage() {
  const session = await getServerAuthSession();
  
  if (session) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-gray-100 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="relative w-80 h-40 mx-auto mb-6">
            <Image
              src="/sgn-logo.png"
              alt="SGN Logo"
              fill
              className="object-contain"
              priority
            />
          </div>
          <h1 className="text-2xl font-bold text-sgn-dark mb-2">
            Sistema de RRHH
          </h1>
          <p className="text-gray-600">
            Accede a tu cuenta para gestionar tus solicitudes
          </p>
        </div>

        <div className="sgn-card p-8">
          <LoginForm />
        </div>

        <div className="text-center mt-6 text-sm text-gray-500">
          <p>SGN © 2024. Todos los derechos reservados.</p>
        </div>
      </div>
    </div>
  );
}

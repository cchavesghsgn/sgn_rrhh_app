
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Providers } from '../components/providers';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'SGN RRHH - Sistema de Gestión de Recursos Humanos',
  description: 'Sistema integral de gestión de recursos humanos para SGN',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={inter.className}>
        <Providers>
          <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
            {children}
          </div>
        </Providers>
      </body>
    </html>
  );
}

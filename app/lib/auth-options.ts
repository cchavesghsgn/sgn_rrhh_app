
import { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { PrismaAdapter } from '@next-auth/prisma-adapter';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  // Explicit secret so NextAuth doesn't rely only on env detection
  // Required in production; in dev it can be undefined
  secret: process.env.NEXTAUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
  // Permitir auto-detección de URL en preview/producción
  ...(process.env.NEXTAUTH_URL ? {} : {
    trustHost: true
  }),
  // Configuración explícita de cookies para preview environments
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        // Auto-detectar secure basado en protocolo
        secure: process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https:') || false,
        domain: undefined // Permitir auto-detección del dominio
      }
    },
    callbackUrl: {
      name: `next-auth.callback-url`,
      options: {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https:') || false,
        domain: undefined
      }
    },
    csrfToken: {
      name: `next-auth.csrf-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production' || process.env.NEXTAUTH_URL?.startsWith('https:') || false,
        domain: undefined
      }
    }
  },
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' }
      },
      async authorize(credentials) {
        console.log('🔐 Attempting login for:', credentials?.email);
        
        if (!credentials?.email || !credentials?.password) {
          console.log('❌ Missing credentials');
          return null;
        }

        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email },
            include: { employees: true }
          });

          console.log('👤 User found:', user ? 'YES' : 'NO');

          if (!user) {
            console.log('❌ User not found');
            return null;
          }

          const isPasswordValid = await bcrypt.compare(credentials.password, user.password);
          console.log('🔑 Password valid:', isPasswordValid);

          if (!isPasswordValid) {
            console.log('❌ Invalid password');
            return null;
          }

          const authUser = {
            id: user.id,
            email: user.email,
            name: user.name || `${user.employees?.firstName} ${user.employees?.lastName}` || user.email,
            role: user.role,
            image: user.employees?.photo
          };

          console.log('✅ Authentication successful for:', authUser.email);
          return authUser;
        } catch (error) {
          console.error('💥 Auth error:', error);
          return null;
        }
      }
    })
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  jwt: {
    maxAge: 30 * 24 * 60 * 60, // 30 días
  },
  callbacks: {
    async jwt({ token, user }) {
      console.log('🎟️ JWT callback:', { hasUser: !!user, tokenId: token.id });
      if (user) {
        token.role = user.role;
        token.id = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      console.log('🎭 Session callback:', { hasToken: !!token, hasSession: !!session });
      if (token && session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
      }
      console.log('✅ Session created:', { userId: session.user?.id, role: session.user?.role });
      return session;
    },
    async redirect({ url, baseUrl }) {
      console.log('🔄 Redirect callback:', { url, baseUrl });
      // Forzar redirect al dashboard después de login exitoso
      if (url === baseUrl || url === `${baseUrl}/`) {
        console.log('🏠 Redirecting to dashboard');
        return `${baseUrl}/dashboard`;
      }
      // Permite redirect a páginas dentro del mismo dominio
      if (url.startsWith("/")) return `${baseUrl}${url}`;
      // Permite redirect a la misma URL base
      if (new URL(url).origin === baseUrl) return url;
      return `${baseUrl}/dashboard`;
    }
  },
  pages: {
    signIn: '/login',
    error: '/login'
  }
};

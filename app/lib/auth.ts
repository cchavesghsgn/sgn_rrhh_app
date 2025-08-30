
import { getServerSession } from 'next-auth/next';
import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';
import { authOptions } from './auth-options';

export { authOptions };

export const getServerAuthSession = async () => {
  try {
    // Intentar método estándar primero
    const standardSession = await getServerSession(authOptions);
    if (standardSession) {
      return standardSession;
    }

    // Fallback para preview environments: leer cookies directamente
    const cookieStore = cookies();
    const sessionTokenName = 'next-auth.session-token';
    const sessionToken = cookieStore.get(sessionTokenName)?.value;
    
    if (!sessionToken) {
      return null;
    }

    // Decodificar JWT token manualmente
    const decoded = await decode({
      token: sessionToken,
      secret: authOptions.jwt?.secret || process.env.NEXTAUTH_SECRET || ''
    });

    if (!decoded) {
      return null;
    }

    // Construir sesión manualmente
    return {
      user: {
        id: decoded.id as string,
        email: decoded.email as string,
        name: decoded.name as string,
        role: decoded.role as string,
        image: decoded.image as string
      },
      expires: new Date((decoded.exp as number) * 1000).toISOString()
    };

  } catch (error) {
    console.error('Error in getServerAuthSession:', error);
    return null;
  }
};

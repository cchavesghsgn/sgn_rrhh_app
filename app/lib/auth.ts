
import { getServerSession } from 'next-auth/next';
import { cookies } from 'next/headers';
import { decode } from 'next-auth/jwt';
import { authOptions } from './auth-options';

export { authOptions };

export const getServerAuthSession = async () => {
  try {
    console.log('🔍 getServerAuthSession: Starting...');
    
    // Intentar método estándar primero
    console.log('🔍 getServerAuthSession: Trying standard method...');
    const standardSession = await getServerSession(authOptions);
    
    if (standardSession) {
      console.log('✅ getServerAuthSession: Standard method worked!', {
        userId: standardSession.user?.id,
        userEmail: standardSession.user?.email
      });
      return standardSession;
    }
    
    console.log('⚠️ getServerAuthSession: Standard method failed, trying fallback...');

    // Fallback para preview environments: leer cookies directamente
    const cookieStore = cookies();
    const sessionTokenName = 'next-auth.session-token';
    const sessionToken = cookieStore.get(sessionTokenName)?.value;
    
    console.log('🍪 getServerAuthSession: Cookie check:', {
      hasCookieStore: !!cookieStore,
      hasSessionToken: !!sessionToken,
      tokenLength: sessionToken?.length || 0
    });
    
    if (!sessionToken) {
      console.log('❌ getServerAuthSession: No session token found in cookies');
      return null;
    }

    // Decodificar JWT token manualmente
    console.log('🔓 getServerAuthSession: Attempting to decode JWT...');
    const decoded = await decode({
      token: sessionToken,
      secret: authOptions.jwt?.secret || process.env.NEXTAUTH_SECRET || ''
    });

    if (!decoded) {
      console.log('❌ getServerAuthSession: JWT decode failed');
      return null;
    }
    
    console.log('✅ getServerAuthSession: JWT decoded successfully:', {
      userId: decoded.id,
      userEmail: decoded.email
    });

    // Construir sesión manualmente
    const manualSession = {
      user: {
        id: decoded.id as string,
        email: decoded.email as string,
        name: decoded.name as string,
        role: decoded.role as string,
        image: decoded.image as string
      },
      expires: new Date((decoded.exp as number) * 1000).toISOString()
    };
    
    console.log('✅ getServerAuthSession: Manual session created successfully');
    return manualSession;

  } catch (error) {
    console.error('💥 Error in getServerAuthSession:', error);
    return null;
  }
};


import { authOptions } from '../lib/auth-options';

async function debugNextAuthConfig() {
  console.log('🔍 Depurando configuración de NextAuth...\n');

  console.log('🔧 Configuración actual:');
  console.log('=======================');
  
  // Verificar providers
  console.log('📦 Providers:', authOptions.providers?.length || 0);
  authOptions.providers?.forEach((provider, index) => {
    console.log(`   ${index + 1}. ${provider.name} (${provider.type})`);
  });

  // Verificar session strategy
  console.log('🎫 Session strategy:', authOptions.session?.strategy || 'jwt (default)');
  console.log('⏰ Session maxAge:', authOptions.session?.maxAge || '30 days (default)');

  // Verificar JWT config
  console.log('🔐 JWT maxAge:', authOptions.jwt?.maxAge || '30 days (default)');

  // Verificar callbacks
  console.log('🔄 Callbacks configurados:');
  console.log('   jwt:', !!authOptions.callbacks?.jwt);
  console.log('   session:', !!authOptions.callbacks?.session);
  console.log('   redirect:', !!authOptions.callbacks?.redirect);

  // Verificar páginas personalizadas
  console.log('📄 Páginas personalizadas:');
  console.log('   signIn:', authOptions.pages?.signIn || '/api/auth/signin (default)');
  console.log('   error:', authOptions.pages?.error || '/api/auth/error (default)');

  // Verificar variables de entorno
  console.log('\n🌍 Variables de entorno:');
  console.log('========================');
  console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL || '❌ No configurada');
  console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✅ Configurada' : '❌ No configurada');
  console.log('NODE_ENV:', process.env.NODE_ENV || '❌ No configurada');
  console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Configurada' : '❌ No configurada');

  // Verificar debug
  console.log('\n🐛 Debug habilitado:', authOptions.debug ? '✅ SÍ' : '❌ NO');

  console.log('\n💡 Recomendaciones:');
  console.log('===================');
  
  if (!process.env.NEXTAUTH_SECRET) {
    console.log('⚠️  Agregar NEXTAUTH_SECRET a las variables de entorno');
  }
  
  if (!process.env.NEXTAUTH_URL) {
    console.log('⚠️  Agregar NEXTAUTH_URL a las variables de entorno');
  }

  if (!authOptions.debug) {
    console.log('💭 Considera habilitar debug para más información');
  }
}

debugNextAuthConfig().catch(console.error);

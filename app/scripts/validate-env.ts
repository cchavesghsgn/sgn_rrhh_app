
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Cargar variables de entorno
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

/**
 * VALIDADOR DE VARIABLES DE ENTORNO
 * Verifica que todas las variables críticas estén configuradas
 */

const REQUIRED_VARS = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL'
];

const OPTIONAL_VARS = [
  'SMTP_HOST',
  'SMTP_PORT', 
  'SMTP_USER',
  'SMTP_PASS',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'GOOGLE_REFRESH_TOKEN',
  'GOOGLE_CALENDAR_ID'
];

async function validateEnvironment() {
  console.log('🔍 Validando variables de entorno...');
  
  const errors = [];
  const warnings = [];
  
  // Verificar variables obligatorias
  for (const varName of REQUIRED_VARS) {
    const value = process.env[varName];
    if (!value) {
      errors.push(`❌ Variable obligatoria faltante: ${varName}`);
    } else if (varName === 'NEXTAUTH_SECRET' && value.length < 32) {
      warnings.push(`⚠️  NEXTAUTH_SECRET debería tener al menos 32 caracteres`);
    } else {
      console.log(`✅ ${varName}: configurada`);
    }
  }
  
  // Verificar variables opcionales
  for (const varName of OPTIONAL_VARS) {
    const value = process.env[varName];
    if (!value) {
      console.log(`ℹ️  Variable opcional no configurada: ${varName}`);
    } else {
      console.log(`✅ ${varName}: configurada`);
    }
  }
  
  // Verificar NODE_ENV
  const nodeEnv = process.env.NODE_ENV;
  if (!nodeEnv) {
    warnings.push(`⚠️  NODE_ENV no está configurada, usando 'development'`);
  } else {
    console.log(`✅ NODE_ENV: ${nodeEnv}`);
  }
  
  // Mostrar resultados
  if (errors.length > 0) {
    console.log('\n❌ ERRORES CRÍTICOS:');
    errors.forEach(error => console.log(error));
    console.log('\n📖 Para resolver:');
    console.log('1. Copia .env.example a .env.local');
    console.log('2. Configura todas las variables requeridas');
    console.log('3. Ejecuta este script nuevamente');
    process.exit(1);
  }
  
  if (warnings.length > 0) {
    console.log('\n⚠️  ADVERTENCIAS:');
    warnings.forEach(warning => console.log(warning));
  }
  
  console.log('\n✅ Validación de entorno completada exitosamente');
  
  // Verificar conexión a base de datos
  if (process.env.DATABASE_URL) {
    console.log('\n🔌 Verificando conexión a base de datos...');
    try {
      const { PrismaClient } = await import('@prisma/client');
      const prisma = new PrismaClient();
      await prisma.$connect();
      await prisma.$disconnect();
      console.log('✅ Conexión a base de datos exitosa');
    } catch (error) {
      console.log('❌ Error de conexión a base de datos:', error);
      process.exit(1);
    }
  }
}

validateEnvironment().catch(console.error);

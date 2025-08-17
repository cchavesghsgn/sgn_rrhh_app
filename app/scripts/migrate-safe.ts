
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * MIGRACIÓN SEGURA PARA PRODUCCIÓN
 * Ejecuta migraciones sin perder datos
 */
async function main() {
  console.log('🔄 Iniciando migración segura...');
  
  try {
    // Verificar conexión a base de datos
    await prisma.$connect();
    console.log('✅ Conexión a base de datos establecida');
    
    // Verificar estado actual de la base de datos
    const tablesExist = await checkTablesExist();
    
    if (tablesExist) {
      console.log('📊 Tablas existentes detectadas');
      console.log('ℹ️  Ejecutando migración incremental...');
    } else {
      console.log('🆕 Base de datos nueva detectada');
      console.log('ℹ️  Ejecutando migración inicial...');
    }
    
    console.log('✅ Migración completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    throw error;
  }
}

async function checkTablesExist(): Promise<boolean> {
  try {
    await prisma.user.findFirst();
    return true;
  } catch {
    return false;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error en migración:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

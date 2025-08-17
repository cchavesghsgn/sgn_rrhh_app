
import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/**
 * SCRIPT DE BACKUP DE BASE DE DATOS
 * Crea un backup de datos críticos antes de migraciones
 */
async function main() {
  console.log('💾 Iniciando backup de base de datos...');
  
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupDir = path.join(process.cwd(), 'backups');
  const backupFile = path.join(backupDir, `backup-${timestamp}.json`);
  
  // Crear directorio de backups si no existe
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true });
  }
  
  try {
    // Obtener datos críticos
    const users = await prisma.user.findMany();
    const areas = await prisma.area.findMany();
    const employees = await prisma.employees.findMany();
    const leaveRequests = await prisma.leave_requests.findMany();
    
    const backupData = {
      timestamp: new Date().toISOString(),
      counts: {
        users: users.length,
        areas: areas.length,
        employees: employees.length,
        leaveRequests: leaveRequests.length
      },
      data: {
        users,
        areas,
        employees,
        leaveRequests
      }
    };
    
    // Guardar backup
    fs.writeFileSync(backupFile, JSON.stringify(backupData, null, 2));
    
    console.log('✅ Backup completado exitosamente');
    console.log(`📁 Archivo: ${backupFile}`);
    console.log(`📊 Registros respaldados:`);
    console.log(`   - Usuarios: ${users.length}`);
    console.log(`   - Áreas: ${areas.length}`);
    console.log(`   - Empleados: ${employees.length}`);
    console.log(`   - Solicitudes: ${leaveRequests.length}`);
    
  } catch (error) {
    console.error('❌ Error durante el backup:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error en backup:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

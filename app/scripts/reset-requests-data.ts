
/**
 * Script para reiniciar datos de solicitudes
 * 
 * FUNCIONES:
 * - Elimina TODAS las solicitudes de permisos de la base de datos
 * - Elimina todos los archivos adjuntos relacionados  
 * - Restaura los días/horas disponibles de todos los empleados a su estado inicial
 * 
 * ADVERTENCIA: Esta operación es IRREVERSIBLE
 * 
 * USO:
 * yarn tsx scripts/reset-requests-data.ts
 * 
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function resetRequestsData() {
  console.log('🚀 Iniciando proceso de reinicio de datos...\n');

  try {
    // 1. Contar registros existentes para mostrar estadísticas
    console.log('📊 Consultando estado actual de la base de datos...');
    const currentRequests = await prisma.leave_requests.count();
    const currentAttachments = await prisma.attachments.count();
    const totalEmployees = await prisma.employees.count();
    
    console.log(`   • Solicitudes existentes: ${currentRequests}`);
    console.log(`   • Archivos adjuntos existentes: ${currentAttachments}`);
    console.log(`   • Total empleados: ${totalEmployees}\n`);

    if (currentRequests === 0) {
      console.log('ℹ️  No hay solicitudes para eliminar. Solo se restaurarán los días/horas disponibles.\n');
    }

    // 2. Eliminar todos los archivos físicos de attachments
    console.log('🗂️  Eliminando archivos adjuntos físicos...');
    const uploadsDir = path.join(__dirname, '..', 'uploads');
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        const filePath = path.join(uploadsDir, file);
        if (fs.lstatSync(filePath).isFile()) {
          fs.unlinkSync(filePath);
          console.log(`   ✅ Eliminado: ${file}`);
        }
      }
      console.log(`   📁 Limpieza de archivos completada\n`);
    } else {
      console.log('   ℹ️  Directorio uploads no existe\n');
    }

    // 3. Eliminar todas las solicitudes (los attachments se eliminan automáticamente por CASCADE)
    console.log('🗑️  Eliminando todas las solicitudes...');
    const deletedRequests = await prisma.leave_requests.deleteMany({});
    console.log(`   ✅ Eliminadas ${deletedRequests.count} solicitudes\n`);

    // 4. Restaurar días/horas disponibles para todos los empleados
    console.log('🔄 Restaurando días/horas disponibles para todos los empleados...');
    
    // Usar consulta SQL cruda porque Prisma no permite referenciar otros campos en updateMany
    await prisma.$executeRaw`
      UPDATE employees 
      SET 
        "vacationDays" = "totalVacationDays",
        "personalHours" = "totalPersonalHours", 
        "remoteHours" = "totalRemoteHours",
        "availableHours" = "totalAvailableHours",
        "updatedAt" = NOW()
    `;

    console.log(`   ✅ Restaurados los días/horas de todos los empleados\n`);

    // 5. Mostrar resumen final
    console.log('📋 RESUMEN DE OPERACIONES COMPLETADAS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`✅ Solicitudes eliminadas: ${currentRequests}`);
    console.log(`✅ Archivos adjuntos eliminados: ${currentAttachments}`);
    console.log(`✅ Empleados actualizados: ${totalEmployees}`);
    console.log('✅ Días de vacaciones: Restaurados al total asignado');
    console.log('✅ Horas personales: Restauradas al total asignado');
    console.log('✅ Horas remotas: Restauradas al total asignado');
    console.log('✅ Horas particulares: Restauradas al total asignado');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n🎉 ¡Reinicio de datos completado exitosamente!');
    console.log('💡 Todos los empleados tienen ahora sus días/horas disponibles restaurados.');
    console.log('💡 Todas las solicitudes anteriores han sido eliminadas.\n');

  } catch (error) {
    console.error('❌ ERROR durante el proceso de reinicio:', error);
    
    if (error instanceof Error) {
      console.error('   Detalle del error:', error.message);
    }
    
    console.log('\n⚠️  El proceso fue interrumpido. Algunos cambios podrían haber sido aplicados parcialmente.');
    console.log('💡 Revisa manualmente el estado de la base de datos antes de ejecutar nuevamente.');
    
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    console.log('🔌 Conexión a la base de datos cerrada.');
  }
}

// Función de confirmación para evitar ejecución accidental
function showWarningAndConfirm() {
  console.log('\n⚠️  ADVERTENCIA IMPORTANTE ⚠️');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Este script realizará las siguientes operaciones IRREVERSIBLES:');
  console.log('• Eliminará TODAS las solicitudes de permisos');
  console.log('• Eliminará TODOS los archivos adjuntos');  
  console.log('• Restaurará los días/horas disponibles de TODOS los empleados');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  // En un entorno de producción real, aquí podrías pedir confirmación
  // Para este script, asumimos que el usuario ya está seguro cuando lo ejecuta
  console.log('🏁 Iniciando proceso en 3 segundos...');
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(true);
    }, 3000);
  });
}

// Función principal
async function main() {
  console.log('🔄 SGN RRHH - Script de Reinicio de Datos');
  console.log('=========================================\n');
  
  await showWarningAndConfirm();
  await resetRequestsData();
}

// Ejecutar solo si es llamado directamente
if (require.main === module) {
  main().catch((error) => {
    console.error('💥 Error fatal en el script:', error);
    process.exit(1);
  });
}

export { resetRequestsData };

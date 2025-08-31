

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

/**
 * SCRIPT DE IMPORTACIÓN DE DATOS
 * Importa datos desde un archivo de exportación a una nueva base de datos
 */
async function main() {
  console.log('📥 Iniciando importación de datos...');
  
  // Buscar el archivo de exportación más reciente
  const exportDir = path.join(process.cwd(), 'exports');
  
  if (!fs.existsSync(exportDir)) {
    console.error('❌ No se encontró directorio de exportación');
    process.exit(1);
  }
  
  const exportFiles = fs.readdirSync(exportDir)
    .filter(file => file.startsWith('export-') && file.endsWith('.json'))
    .sort()
    .reverse();
  
  if (exportFiles.length === 0) {
    console.error('❌ No se encontraron archivos de exportación');
    process.exit(1);
  }
  
  const latestExport = path.join(exportDir, exportFiles[0]);
  console.log(`📁 Usando archivo: ${latestExport}`);
  
  try {
    // Leer archivo de exportación
    const exportContent = fs.readFileSync(latestExport, 'utf-8');
    const exportData = JSON.parse(exportContent);
    
    console.log(`📊 Datos a importar:`);
    console.log(`   - Áreas: ${exportData.counts.areas}`);
    console.log(`   - Usuarios: ${exportData.counts.users}`);
    console.log(`   - Empleados: ${exportData.counts.employees}`);
    console.log(`   - Solicitudes: ${exportData.counts.leaveRequests}`);
    console.log(`   - Adjuntos: ${exportData.counts.attachments}`);
    
    // Verificar conexión a nueva base de datos
    await prisma.$connect();
    console.log('✅ Conexión a nueva base de datos establecida');
    
    // Limpiar datos existentes (si los hay)
    console.log('🧹 Limpiando datos existentes...');
    await prisma.attachments.deleteMany();
    await prisma.leave_requests.deleteMany();
    await prisma.employees.deleteMany();
    await prisma.user.deleteMany();
    await prisma.area.deleteMany();
    
    console.log('📥 Importando datos...');
    
    // Importar en orden correcto (respetando relaciones)
    
    // 1. Áreas
    if (exportData.data.areas?.length > 0) {
      for (const area of exportData.data.areas) {
        await prisma.area.create({
          data: {
            id: area.id,
            name: area.name,
            description: area.description,
            createdAt: new Date(area.createdAt),
            updatedAt: new Date(area.updatedAt)
          }
        });
      }
      console.log(`   ✅ Áreas importadas: ${exportData.data.areas.length}`);
    }
    
    // 2. Usuarios
    if (exportData.data.users?.length > 0) {
      for (const user of exportData.data.users) {
        await prisma.user.create({
          data: {
            id: user.id,
            name: user.name,
            email: user.email,
            password: user.password,
            role: user.role,
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt)
          }
        });
      }
      console.log(`   ✅ Usuarios importados: ${exportData.data.users.length}`);
    }
    
    // 3. Empleados
    if (exportData.data.employees?.length > 0) {
      for (const employee of exportData.data.employees) {
        await prisma.employees.create({
          data: {
            id: employee.id,
            user_id: employee.user_id,
            area_id: employee.area_id,
            dni: employee.dni,
            phone: employee.phone,
            position: employee.position,
            hire_date: employee.hire_date ? new Date(employee.hire_date) : null,
            vacation_days: employee.vacation_days,
            personal_days: employee.personal_days,
            remote_days: employee.remote_days,
            particular_hours: employee.particular_hours,
            createdAt: new Date(employee.createdAt),
            updatedAt: new Date(employee.updatedAt)
          }
        });
      }
      console.log(`   ✅ Empleados importados: ${exportData.data.employees.length}`);
    }
    
    // 4. Solicitudes de permisos
    if (exportData.data.leaveRequests?.length > 0) {
      for (const request of exportData.data.leaveRequests) {
        await prisma.leave_requests.create({
          data: {
            id: request.id,
            employee_id: request.employee_id,
            area_id: request.area_id,
            type: request.type,
            start_date: new Date(request.start_date),
            end_date: new Date(request.end_date),
            start_time: request.start_time,
            end_time: request.end_time,
            period: request.period,
            reason: request.reason,
            status: request.status,
            admin_notes: request.admin_notes,
            createdAt: new Date(request.createdAt),
            updatedAt: new Date(request.updatedAt)
          }
        });
      }
      console.log(`   ✅ Solicitudes importadas: ${exportData.data.leaveRequests.length}`);
    }
    
    // 5. Adjuntos
    if (exportData.data.attachments?.length > 0) {
      for (const attachment of exportData.data.attachments) {
        await prisma.attachments.create({
          data: {
            id: attachment.id,
            request_id: attachment.request_id,
            file_name: attachment.file_name,
            file_type: attachment.file_type,
            file_size: attachment.file_size,
            cloud_storage_path: attachment.cloud_storage_path,
            createdAt: new Date(attachment.createdAt)
          }
        });
      }
      console.log(`   ✅ Adjuntos importados: ${exportData.data.attachments.length}`);
    }
    
    console.log('✅ Importación completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante la importación:', error);
    throw error;
  }
}

main()
  .catch((e) => {
    console.error('❌ Error en importación:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

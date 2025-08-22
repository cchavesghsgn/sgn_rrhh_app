
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

/**
 * SEED SEGURO PARA PRODUCCIÓN
 * Este script NO borra datos existentes
 * Solo agrega datos si no existen
 */
async function main() {
  console.log('🌱 Iniciando seed seguro para producción...');
  console.log('ℹ️  Este script NO borrará datos existentes');

  // Verificar si ya hay datos
  const existingUsers = await prisma.user.count();
  const existingAreas = await prisma.area.count();

  if (existingUsers > 0 || existingAreas > 0) {
    console.log(`📊 Base de datos ya contiene datos:`);
    console.log(`   - Usuarios: ${existingUsers}`);
    console.log(`   - Áreas: ${existingAreas}`);
    console.log('✅ No es necesario ejecutar seed inicial');
    return;
  }

  console.log('🆕 Base de datos vacía, creando datos iniciales...');

  // Crear áreas solo si no existen
  const areaNames = ['Recursos Humanos', 'Tecnología', 'Finanzas', 'Marketing', 'Operaciones'];
  const areas = [];

  for (const areaName of areaNames) {
    const existingArea = await prisma.area.findUnique({
      where: { name: areaName }
    });

    if (!existingArea) {
      const area = await prisma.area.create({
        data: {
          id: crypto.randomUUID(),
          name: areaName,
          description: `Área de ${areaName}`,
          updatedAt: new Date()
        }
      });
      areas.push(area);
      console.log(`✅ Área creada: ${areaName}`);
    } else {
      areas.push(existingArea);
      console.log(`ℹ️  Área ya existe: ${areaName}`);
    }
  }

  // Crear usuario admin solo si no existe
  const adminEmail = 'john@doe.com';
  const existingAdmin = await prisma.user.findUnique({
    where: { email: adminEmail }
  });

  if (!existingAdmin) {
    const testPasswordHash = await bcrypt.hash('johndoe123', 12);
    
    const adminUser = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: adminEmail,
        password: testPasswordHash,
        name: 'John Doe',
        role: 'ADMIN',
        updatedAt: new Date()
      }
    });

    const adminEmployee = await prisma.employees.create({
      data: {
        id: crypto.randomUUID(),
        userId: adminUser.id,
        dni: '12345678',
        firstName: 'John',
        lastName: 'Doe',
        birthDate: new Date('1985-05-15'),
        hireDate: new Date('2020-01-15'),
        areaId: areas[0].id, // RRHH
        position: 'Director de RRHH',
        phone: '+54 9 11 1234-5678',
        vacationDays: 25,
        personalHours: 120, // 15 días × 8 horas = 120 horas
        remoteHours: 120,   // 15 días × 8 horas = 120 horas
        availableHours: 20,
        totalVacationDays: 25,
        totalPersonalHours: 120,
        totalRemoteHours: 120,
        totalAvailableHours: 20,
        updatedAt: new Date()
      }
    });

    console.log('✅ Usuario administrador creado');
  } else {
    console.log('ℹ️  Usuario administrador ya existe');
  }

  console.log('✅ Seed de producción completado exitosamente!');
  console.log('\n🔑 Credenciales de acceso:');
  console.log('Admin: john@doe.com / johndoe123\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed de producción:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

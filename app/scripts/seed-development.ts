
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

/**
 * SEED PARA DESARROLLO
 * Este script SÍ puede borrar datos para testing
 * NUNCA usar en producción
 */
async function main() {
  console.log('🌱 Iniciando seed de DESARROLLO...');
  console.log('⚠️  ADVERTENCIA: Este script borrará todos los datos existentes');
  
  // Solo permitir en desarrollo
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ ERROR: No se puede ejecutar seed de desarrollo en producción');
    process.exit(1);
  }

  // Limpiar datos existentes (solo en desarrollo)
  await prisma.attachments.deleteMany();
  await prisma.leave_requests.deleteMany();
  await prisma.employees.deleteMany();
  await prisma.user.deleteMany();
  await prisma.area.deleteMany();

  console.log('🧹 Limpieza de datos completada');

  // Crear áreas
  const areas = await Promise.all([
    prisma.area.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Recursos Humanos',
        description: 'Gestión de personal y administración',
        updatedAt: new Date()
      }
    }),
    prisma.area.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Tecnología',
        description: 'Desarrollo y sistemas informáticos',
        updatedAt: new Date()
      }
    }),
    prisma.area.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Finanzas',
        description: 'Contabilidad y gestión financiera',
        updatedAt: new Date()
      }
    }),
    prisma.area.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Marketing',
        description: 'Publicidad y comunicación',
        updatedAt: new Date()
      }
    }),
    prisma.area.create({
      data: {
        id: crypto.randomUUID(),
        name: 'Operaciones',
        description: 'Gestión operativa y logística',
        updatedAt: new Date()
      }
    })
  ]);

  console.log('📍 Áreas creadas:', areas.length);

  // Crear usuarios y empleados de prueba
  const passwordHash = await bcrypt.hash('123456', 12);
  const testPasswordHash = await bcrypt.hash('johndoe123', 12);

  // Admin principal
  const adminUser = await prisma.user.create({
    data: {
      id: crypto.randomUUID(),
      email: 'john@doe.com',
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
      personalHours: 120,
      remoteHours: 120,
      availableHours: 20,
      totalVacationDays: 25,
      totalPersonalHours: 120,
      totalRemoteHours: 120,
      totalAvailableHours: 20,
      updatedAt: new Date()
    }
  });

  // Empleados de ejemplo
  const employeeData = [
    {
      email: 'maria.gonzalez@sgn.com',
      firstName: 'María',
      lastName: 'González',
      dni: '23456789',
      birthDate: new Date('1990-03-22'),
      hireDate: new Date('2021-06-01'),
      areaId: areas[1].id,
      position: 'Desarrolladora Senior',
      phone: '+54 9 11 2345-6789'
    },
    {
      email: 'carlos.rodriguez@sgn.com',
      firstName: 'Carlos',
      lastName: 'Rodríguez',
      dni: '34567890',
      birthDate: new Date('1988-07-12'),
      hireDate: new Date('2020-09-15'),
      areaId: areas[2].id,
      position: 'Contador Principal',
      phone: '+54 9 11 3456-7890'
    }
  ];

  const employees = [];
  for (const data of employeeData) {
    const user = await prisma.user.create({
      data: {
        id: crypto.randomUUID(),
        email: data.email,
        password: passwordHash,
        name: `${data.firstName} ${data.lastName}`,
        role: 'EMPLOYEE',
        updatedAt: new Date()
      }
    });

    const employee = await prisma.employees.create({
      data: {
        id: crypto.randomUUID(),
        userId: user.id,
        dni: data.dni,
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: data.birthDate,
        hireDate: data.hireDate,
        areaId: data.areaId,
        position: data.position,
        phone: data.phone,
        updatedAt: new Date()
      }
    });

    employees.push(employee);
  }

  console.log('👥 Empleados creados:', employees.length + 1);
  console.log('✅ Seed de desarrollo completado!');
  console.log('\n🔑 Credenciales de prueba:');
  console.log('Admin: john@doe.com / johndoe123');
  console.log('Empleados: [usuario]@sgn.com / 123456\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed de desarrollo:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

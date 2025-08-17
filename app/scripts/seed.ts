
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Iniciando seed de la base de datos...');

  // Limpiar datos existentes (opcional)
  await prisma.attachment.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.employee.deleteMany();
  await prisma.user.deleteMany();
  await prisma.area.deleteMany();

  console.log('🧹 Limpieza de datos completada');

  // Crear áreas
  const areas = await Promise.all([
    prisma.area.create({
      data: {
        name: 'Recursos Humanos',
        description: 'Gestión de personal y administración'
      }
    }),
    prisma.area.create({
      data: {
        name: 'Tecnología',
        description: 'Desarrollo y sistemas informaticos'
      }
    }),
    prisma.area.create({
      data: {
        name: 'Finanzas',
        description: 'Contabilidad y gestión financiera'
      }
    }),
    prisma.area.create({
      data: {
        name: 'Marketing',
        description: 'Publicidad y comunicación'
      }
    }),
    prisma.area.create({
      data: {
        name: 'Operaciones',
        description: 'Gestión operativa y logística'
      }
    })
  ]);

  console.log('📍 Áreas creadas:', areas.length);

  // Crear usuarios y empleados
  const passwordHash = await bcrypt.hash('123456', 12);
  const testPasswordHash = await bcrypt.hash('johndoe123', 12);

  // Admin principal
  const adminUser = await prisma.user.create({
    data: {
      email: 'john@doe.com',
      password: testPasswordHash,
      name: 'John Doe',
      role: 'ADMIN'
    }
  });

  const adminEmployee = await prisma.employee.create({
    data: {
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
      totalPersonalHours: 120, // 15 días × 8 horas = 120 horas
      totalRemoteHours: 120,   // 15 días × 8 horas = 120 horas
      totalAvailableHours: 20
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
      areaId: areas[1].id, // Tecnología
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
      areaId: areas[2].id, // Finanzas
      position: 'Contador Principal',
      phone: '+54 9 11 3456-7890'
    },
    {
      email: 'ana.martinez@sgn.com',
      firstName: 'Ana',
      lastName: 'Martínez',
      dni: '45678901',
      birthDate: new Date('1992-12-08'),
      hireDate: new Date('2022-03-10'),
      areaId: areas[3].id, // Marketing
      position: 'Especialista en Marketing Digital',
      phone: '+54 9 11 4567-8901'
    },
    {
      email: 'luis.fernandez@sgn.com',
      firstName: 'Luis',
      lastName: 'Fernández',
      dni: '56789012',
      birthDate: new Date('1987-09-25'),
      hireDate: new Date('2019-11-20'),
      areaId: areas[4].id, // Operaciones
      position: 'Supervisor de Operaciones',
      phone: '+54 9 11 5678-9012'
    },
    {
      email: 'patricia.lopez@sgn.com',
      firstName: 'Patricia',
      lastName: 'López',
      dni: '67890123',
      birthDate: new Date('1991-01-18'),
      hireDate: new Date('2021-08-12'),
      areaId: areas[1].id, // Tecnología
      position: 'Analista de Sistemas',
      phone: '+54 9 11 6789-0123'
    },
    {
      email: 'diego.silva@sgn.com',
      firstName: 'Diego',
      lastName: 'Silva',
      dni: '78901234',
      birthDate: new Date('1989-04-30'),
      hireDate: new Date('2020-12-05'),
      areaId: areas[2].id, // Finanzas
      position: 'Analista Financiero',
      phone: '+54 9 11 7890-1234'
    },
    {
      email: 'sofia.herrera@sgn.com',
      firstName: 'Sofía',
      lastName: 'Herrera',
      dni: '89012345',
      birthDate: new Date('1993-11-14'),
      hireDate: new Date('2022-07-18'),
      areaId: areas[3].id, // Marketing
      position: 'Coordinadora de Comunicaciones',
      phone: '+54 9 11 8901-2345'
    },
    {
      email: 'roberto.jimenez@sgn.com',
      firstName: 'Roberto',
      lastName: 'Jiménez',
      dni: '90123456',
      birthDate: new Date('1986-06-03'),
      hireDate: new Date('2019-04-22'),
      areaId: areas[4].id, // Operaciones
      position: 'Especialista en Logística',
      phone: '+54 9 11 9012-3456'
    }
  ];

  const employees = [];
  for (const data of employeeData) {
    const user = await prisma.user.create({
      data: {
        email: data.email,
        password: passwordHash,
        name: `${data.firstName} ${data.lastName}`,
        role: 'EMPLOYEE'
      }
    });

    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        dni: data.dni,
        firstName: data.firstName,
        lastName: data.lastName,
        birthDate: data.birthDate,
        hireDate: data.hireDate,
        areaId: data.areaId,
        position: data.position,
        phone: data.phone,
        totalVacationDays: 20,
        totalPersonalHours: 96, // 12 días × 8 horas = 96 horas
        totalRemoteHours: 96,   // 12 días × 8 horas = 96 horas
        totalAvailableHours: 16
      }
    });

    employees.push(employee);
  }

  console.log('👥 Empleados creados:', employees.length + 1); // +1 para el admin

  // Crear algunas solicitudes de ejemplo
  const sampleRequests = [
    {
      employeeId: employees[0].id, // María
      type: 'PERSONAL',
      startDate: new Date('2024-08-20'),
      endDate: new Date('2024-08-20'),
      reason: 'Trámites personales',
      status: 'APPROVED'
    },
    {
      employeeId: employees[1].id, // Carlos
      type: 'REMOTE',
      startDate: new Date('2024-08-22'),
      endDate: new Date('2024-08-23'),
      reason: 'Trabajo remoto por proyecto especial',
      status: 'PENDING'
    },
    {
      employeeId: employees[2].id, // Ana
      type: 'LICENSE',
      startDate: new Date('2024-08-25'),
      endDate: new Date('2024-08-25'),
      reason: 'Consulta médica',
      status: 'APPROVED'
    },
    {
      employeeId: employees[3].id, // Luis
      type: 'HOURS',
      startDate: new Date('2024-08-21'),
      endDate: new Date('2024-08-21'),
      hours: 4,
      reason: 'Salida temprana por trámite familiar',
      status: 'REJECTED',
      adminNotes: 'No se puede aprobar por alta carga de trabajo ese día'
    },
    {
      employeeId: employees[4].id, // Patricia
      type: 'PERSONAL',
      startDate: new Date('2024-08-28'),
      endDate: new Date('2024-08-29'),
      reason: 'Asuntos familiares',
      status: 'PENDING'
    }
  ];

  for (const requestData of sampleRequests) {
    await prisma.leaveRequest.create({
      data: requestData as any
    });
  }

  console.log('📝 Solicitudes de ejemplo creadas:', sampleRequests.length);

  console.log('✅ Seed completado exitosamente!');
  console.log('\n🔑 Credenciales de prueba:');
  console.log('Admin: john@doe.com / johndoe123');
  console.log('Empleados: [usuario]@sgn.com / 123456');
  console.log('Ejemplo: maria.gonzalez@sgn.com / 123456\n');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function diagnoseAuth() {
  console.log('🔍 Iniciando diagnóstico de autenticación...\n');

  try {
    // 1. Verificar conexión a la base de datos
    console.log('1️⃣ Verificando conexión a la base de datos...');
    await prisma.$connect();
    console.log('✅ Conexión a la base de datos exitosa\n');

    // 2. Contar usuarios en la base de datos
    console.log('2️⃣ Verificando usuarios en la base de datos...');
    const userCount = await prisma.user.count();
    console.log(`📊 Total de usuarios en la base: ${userCount}\n`);

    if (userCount === 0) {
      console.log('⚠️ No hay usuarios en la base de datos. Creando usuario admin...');
      
      const adminPassword = await bcrypt.hash('admin123', 12);
      const adminUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: 'admin@sgn.com',
          password: adminPassword,
          name: 'Administrador',
          role: 'ADMIN',
          updatedAt: new Date()
        }
      });
      
      console.log('✅ Usuario admin creado:');
      console.log(`   📧 Email: admin@sgn.com`);
      console.log(`   🔑 Password: admin123`);
      console.log(`   👤 ID: ${adminUser.id}\n`);
    }

    // 3. Listar todos los usuarios
    console.log('3️⃣ Listando todos los usuarios...');
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        employees: {
          select: {
            firstName: true,
            lastName: true,
            position: true
          }
        }
      }
    });

    if (users.length === 0) {
      console.log('❌ No se encontraron usuarios');
    } else {
      users.forEach((user, index) => {
        console.log(`👤 Usuario ${index + 1}:`);
        console.log(`   📧 Email: ${user.email}`);
        console.log(`   👤 Nombre: ${user.name}`);
        console.log(`   🛡️ Rol: ${user.role}`);
        console.log(`   📅 Creado: ${user.createdAt.toLocaleString()}`);
        if (user.employees) {
          console.log(`   💼 Empleado: ${user.employees.firstName} ${user.employees.lastName} - ${user.employees.position}`);
        }
        console.log('');
      });
    }

    // 4. Probar autenticación con credenciales conocidas
    console.log('4️⃣ Probando autenticación...');
    const testCredentials = [
      { email: 'admin@sgn.com', password: 'admin123' },
      { email: 'john@doe.com', password: 'johndoe123' },
      { email: 'maria.gonzalez@sgn.com', password: '123456' }
    ];

    for (const creds of testCredentials) {
      console.log(`🔐 Probando login: ${creds.email}`);
      
      const user = await prisma.user.findUnique({
        where: { email: creds.email }
      });

      if (!user) {
        console.log(`   ❌ Usuario no encontrado: ${creds.email}`);
        continue;
      }

      const isPasswordValid = await bcrypt.compare(creds.password, user.password);
      console.log(`   🔑 Password válida: ${isPasswordValid ? '✅ SÍ' : '❌ NO'}`);
      
      if (isPasswordValid) {
        console.log(`   ✅ Autenticación exitosa para: ${creds.email}`);
      }
      console.log('');
    }

    // 5. Crear un usuario de prueba con contraseña conocida
    console.log('5️⃣ Creando usuario de prueba...');
    const testEmail = 'test@sgn.com';
    const testPassword = 'test123';
    
    // Verificar si ya existe
    const existingTestUser = await prisma.user.findUnique({
      where: { email: testEmail }
    });

    if (existingTestUser) {
      console.log(`⚠️ Usuario de prueba ya existe: ${testEmail}`);
    } else {
      const hashedTestPassword = await bcrypt.hash(testPassword, 12);
      const testUser = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: testEmail,
          password: hashedTestPassword,
          name: 'Usuario de Prueba',
          role: 'ADMIN',
          updatedAt: new Date()
        }
      });

      console.log('✅ Usuario de prueba creado:');
      console.log(`   📧 Email: ${testEmail}`);
      console.log(`   🔑 Password: ${testPassword}`);
      console.log(`   👤 ID: ${testUser.id}`);
    }

    console.log('\n🎯 RESUMEN DE DIAGNÓSTICO:');
    console.log('=====================================');
    console.log(`📊 Total de usuarios: ${await prisma.user.count()}`);
    console.log('📧 Credenciales para probar:');
    console.log('   admin@sgn.com / admin123');
    console.log('   test@sgn.com / test123');
    console.log('   john@doe.com / johndoe123 (si existe)');

  } catch (error) {
    console.error('💥 Error en diagnóstico:', error);
  } finally {
    await prisma.$disconnect();
  }
}

diagnoseAuth().catch(console.error);

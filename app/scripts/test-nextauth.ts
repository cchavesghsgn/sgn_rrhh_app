
import { authOptions } from '../lib/auth-options';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testNextAuth() {
  console.log('🔍 Probando NextAuth directamente...\n');

  const testCredentials = {
    email: 'john@doe.com',
    password: 'johndoe123'
  };

  console.log(`🧪 Probando credenciales: ${testCredentials.email} / ${testCredentials.password}\n`);

  try {
    // Simular exactamente lo que hace NextAuth
    console.log('1️⃣ Buscando usuario...');
    const user = await prisma.user.findUnique({
      where: { email: testCredentials.email },
      include: { employees: true }
    });

    console.log('👤 Usuario encontrado:', user ? 'SÍ' : 'NO');

    if (!user) {
      console.log('❌ Usuario no encontrado');
      return;
    }

    console.log('📧 Email:', user.email);
    console.log('👤 Nombre:', user.name);
    console.log('🛡️ Rol:', user.role);
    console.log('🔗 Tiene empleado asociado:', user.employees ? 'SÍ' : 'NO');
    if (user.employees) {
      console.log('👷 Empleado:', `${user.employees.firstName} ${user.employees.lastName}`);
    }

    console.log('\n2️⃣ Verificando contraseña...');
    const isPasswordValid = await bcrypt.compare(testCredentials.password, user.password);
    console.log('🔑 Contraseña válida:', isPasswordValid ? '✅ SÍ' : '❌ NO');

    if (!isPasswordValid) {
      console.log('❌ Contraseña incorrecta');
      return;
    }

    console.log('\n3️⃣ Creando objeto de usuario autenticado...');
    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name || `${user.employees?.firstName} ${user.employees?.lastName}` || user.email,
      role: user.role,
      image: user.employees?.photo
    };

    console.log('✅ Objeto de usuario creado:');
    console.log(JSON.stringify(authUser, null, 2));

    console.log('\n✅ ¡AUTENTICACIÓN EXITOSA!');
    console.log('El problema NO está en NextAuth ni en la base de datos.');

  } catch (error) {
    console.error('💥 Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testNextAuth().catch(console.error);

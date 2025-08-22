
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testLogin() {
  console.log('🔍 Probando credenciales de administrador...\n');

  try {
    // Buscar el usuario admin
    const user = await prisma.user.findUnique({
      where: { email: 'john@doe.com' },
      include: { employees: true }
    });

    if (!user) {
      console.log('❌ ERROR: Usuario no encontrado');
      return;
    }

    console.log('✅ Usuario encontrado:');
    console.log('   📧 Email:', user.email);
    console.log('   👤 Nombre:', user.name);
    console.log('   🎭 Rol:', user.role);
    console.log('   🆔 ID:', user.id);

    // Verificar contraseña
    const isPasswordValid = await bcrypt.compare('johndoe123', user.password);
    console.log('\n🔑 Verificación de contraseña:');
    console.log('   Contraseña "johndoe123":', isPasswordValid ? '✅ VÁLIDA' : '❌ INVÁLIDA');

    if (isPasswordValid) {
      console.log('\n🎉 ¡CREDENCIALES CORRECTAS!');
      console.log('👉 Usa estas credenciales en el login:');
      console.log('   📧 Usuario: john@doe.com');
      console.log('   🔒 Contraseña: johndoe123');
    } else {
      console.log('\n❌ Error en la verificación de contraseña');
    }

    // Mostrar información del empleado asociado
    if (user.employees) {
      console.log('\n👥 Información del empleado:');
      console.log('   Nombre:', user.employees.firstName, user.employees.lastName);
      console.log('   DNI:', user.employees.dni);
      console.log('   Área:', user.employees.areaId);
      console.log('   Posición:', user.employees.position);
    }

  } catch (error) {
    console.error('💥 Error en la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();

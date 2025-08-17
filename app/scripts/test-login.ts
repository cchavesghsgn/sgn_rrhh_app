
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function testLogin() {
  console.log('🔍 Probando credenciales de administrador...\n');

  try {
    // Buscar el usuario admin
    const user = await prisma.user.findUnique({
      where: { email: 'john@doe.com' },
      include: { employee: true }
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
    if (user.employee) {
      console.log('\n👥 Información del empleado:');
      console.log('   Nombre:', user.employee.firstName, user.employee.lastName);
      console.log('   DNI:', user.employee.dni);
      console.log('   Área:', user.employee.areaId);
      console.log('   Posición:', user.employee.position);
    }

  } catch (error) {
    console.error('💥 Error en la prueba:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();

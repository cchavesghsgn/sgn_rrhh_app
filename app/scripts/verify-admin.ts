
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Verificando usuario administrador...');

  // Buscar el usuario admin
  const adminUser = await prisma.user.findUnique({
    where: {
      email: 'john@doe.com'
    },
    include: {
      employees: true
    }
  });

  if (!adminUser) {
    console.log('❌ Usuario administrador NO encontrado en la base de datos');
    return;
  }

  console.log('✅ Usuario administrador encontrado:');
  console.log('- Email:', adminUser.email);
  console.log('- Nombre:', adminUser.name);
  console.log('- Role:', adminUser.role);
  console.log('- ID:', adminUser.id);
  console.log('- Password Hash:', adminUser.password ? 'Presente' : 'AUSENTE');
  
  if (adminUser.employees) {
    console.log('- Empleado vinculado:', adminUser.employees.firstName, adminUser.employees.lastName);
  }

  // Verificar si la contraseña es correcta
  if (adminUser.password) {
    const isPasswordValid = await bcrypt.compare('johndoe123', adminUser.password);
    console.log('- Password válida para "johndoe123":', isPasswordValid ? '✅ SÍ' : '❌ NO');
    
    // También probar con otras posibles contraseñas
    const isPassword123456 = await bcrypt.compare('123456', adminUser.password);
    console.log('- Password válida para "123456":', isPassword123456 ? '✅ SÍ' : '❌ NO');
  }

  console.log('\n📊 Resumen de todos los usuarios:');
  const allUsers = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true
    }
  });
  
  allUsers.forEach((user, index) => {
    console.log(`${index + 1}. ${user.email} - ${user.name} (${user.role})`);
  });
}

main()
  .catch((e) => {
    console.error('Error:', e);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

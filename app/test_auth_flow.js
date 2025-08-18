const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function testAuthFlow() {
  try {
    console.log('🔍 Testing complete auth flow...');
    
    // Test user lookup
    const user = await prisma.user.findUnique({
      where: { email: 'john@doe.com' },
      include: { employees: true }
    });
    
    console.log('\n👤 User lookup:');
    console.log('User found:', user ? '✅ YES' : '❌ NO');
    
    if (!user) {
      console.log('❌ User not found, stopping test');
      return;
    }
    
    console.log('User ID:', user.id);
    console.log('User email:', user.email);
    console.log('User role:', user.role);
    console.log('User name:', user.name);
    console.log('Has employee record:', user.employees ? '✅ YES' : '❌ NO');
    
    // Test password
    const testPassword = 'johndoe123';
    const isPasswordValid = await bcrypt.compare(testPassword, user.password);
    console.log('\n🔑 Password test:');
    console.log('Password "johndoe123" valid:', isPasswordValid ? '✅ YES' : '❌ NO');
    
    // Simulate auth user creation
    const authUser = {
      id: user.id,
      email: user.email,
      name: user.name || `${user.employees?.firstName} ${user.employees?.lastName}` || user.email,
      role: user.role,
      image: user.employees?.photo
    };
    
    console.log('\n✨ Auth user object:');
    console.log(JSON.stringify(authUser, null, 2));
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testAuthFlow();

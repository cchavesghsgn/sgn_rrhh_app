const { getServerSession } = require('next-auth');
require('dotenv').config();

// Simple test to check session configuration
console.log('🔍 Debugging login issue...');
console.log('Environment variables:');
console.log('NEXTAUTH_URL:', process.env.NEXTAUTH_URL);
console.log('NEXTAUTH_SECRET:', process.env.NEXTAUTH_SECRET ? '✅ Set' : '❌ Not set');
console.log('DATABASE_URL:', process.env.DATABASE_URL ? '✅ Set' : '❌ Not set');

// Test database connection
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testLogin() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'john@doe.com' }
    });
    
    console.log('\n👤 User test:');
    console.log('User found:', user ? '✅ YES' : '❌ NO');
    
    if (user) {
      console.log('User ID:', user.id);
      console.log('User role:', user.role);
      console.log('User name:', user.name);
    }
    
  } catch (error) {
    console.error('❌ Database error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLogin();

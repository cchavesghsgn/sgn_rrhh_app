
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
require('dotenv').config();

async function testEmployeeCreation() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== TESTING EMPLOYEE CREATION PROCESS ===');
    
    // Get a valid area
    const areas = await prisma.area.findMany();
    if (areas.length === 0) {
      throw new Error('No areas found in database');
    }
    
    const testData = {
      email: `test.user.${Date.now()}@example.com`,
      password: 'testpassword123',
      dni: `TEST${Date.now()}`,
      firstName: 'Test',
      lastName: 'User',
      birthDate: '1990-01-01',
      hireDate: '2024-08-01',
      areaId: areas[0].id,
      position: 'Test Position',
      phone: '123456789',
      role: 'EMPLOYEE'
    };
    
    console.log('Test data:', testData);
    
    // Simulate the exact process from the API
    const hashedPassword = await bcrypt.hash(testData.password, 12);
    
    console.log('Password hashed successfully');
    
    const result = await prisma.$transaction(async (prisma) => {
      console.log('Creating user...');
      const user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email: testData.email,
          password: hashedPassword,
          name: `${testData.firstName} ${testData.lastName}`,
          role: testData.role,
          updatedAt: new Date()
        }
      });
      
      console.log('User created:', user.id);
      
      console.log('Creating employee...');
      const employee = await prisma.employees.create({
        data: {
          id: crypto.randomUUID(),
          userId: user.id,
          dni: testData.dni,
          firstName: testData.firstName,
          lastName: testData.lastName,
          birthDate: new Date(testData.birthDate),
          hireDate: new Date(testData.hireDate),
          areaId: testData.areaId,
          position: testData.position,
          phone: testData.phone || null,
          updatedAt: new Date()
        },
        include: {
          User: true,
          Area: true
        }
      });
      
      console.log('Employee created:', employee.id);
      return employee;
    });

    console.log('✅ Employee creation successful!');
    console.log('Result:', {
      id: result.id,
      name: `${result.firstName} ${result.lastName}`,
      email: result.User.email,
      area: result.Area.name
    });
    
    // Clean up test data
    await prisma.employees.delete({ where: { id: result.id } });
    await prisma.user.delete({ where: { id: result.userId } });
    console.log('✅ Test data cleaned up');
    
  } catch (error) {
    console.error('❌ Employee creation failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

testEmployeeCreation();

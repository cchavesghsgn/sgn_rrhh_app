
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
require('dotenv').config();

async function testLoginAndEmployeeCreation() {
  const prisma = new PrismaClient();
  
  try {
    console.log('=== TESTING LOGIN ===');
    const user = await prisma.user.findUnique({
      where: { email: 'john@doe.com' },
      include: { employees: true }
    });
    
    if (user) {
      const isValidPassword = await bcrypt.compare('johndoe123', user.password);
      console.log('✅ User found:', user.email);
      console.log('✅ Password valid:', isValidPassword);
      console.log('✅ Role:', user.role);
      console.log('✅ Employee data:', !!user.employees);
    } else {
      console.log('❌ User not found');
    }

    console.log('\n=== TESTING DATABASE TABLES ===');
    
    // Test areas table
    const areas = await prisma.area.findMany({
      select: { id: true, name: true }
    });
    console.log('✅ Areas available:', areas.length);
    areas.forEach(area => console.log('  - Area:', area.id, '|', area.name));
    
    // Test employees table structure
    const employeeCount = await prisma.employees.count();
    console.log('✅ Total employees:', employeeCount);
    
    // Test a sample employee creation (dry run)
    console.log('\n=== TESTING EMPLOYEE CREATION LOGIC ===');
    const testData = {
      email: 'test.employee@example.com',
      dni: '12345678X',
      firstName: 'Test',
      lastName: 'Employee',
      birthDate: new Date('1990-01-01'),
      hireDate: new Date('2024-08-01'),
      areaId: areas.length > 0 ? areas[0].id : null,
      position: 'Test Position',
      phone: '123456789'
    };
    
    console.log('Test data prepared:', testData);
    
    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: testData.email }
    });
    console.log('Email exists already:', !!existingUser);
    
    // Check if DNI already exists
    const existingEmployee = await prisma.employees.findUnique({
      where: { dni: testData.dni }
    });
    console.log('DNI exists already:', !!existingEmployee);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testLoginAndEmployeeCreation();

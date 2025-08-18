
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

async function debugDatabaseError() {
    console.log('🔍 === DEBUGGING DATABASE TRANSACTION ===');
    
    const prisma = new PrismaClient();
    
    try {
        // Test 1: Check if areas exist
        console.log('\n1. Checking available areas...');
        const areas = await prisma.areas.findMany();
        console.log('Available areas:', areas.length);
        
        if (areas.length === 0) {
            console.log('❌ No areas found in database');
            return;
        }
        
        console.log('First area:', areas[0]);

        // Test 2: Try to create a simple user
        console.log('\n2. Testing user creation...');
        const testUserId = crypto.randomUUID();
        const testEmail = `test-${Date.now()}@sgn.com`;
        
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash('password123', 12);
        
        const user = await prisma.user.create({
            data: {
                id: testUserId,
                email: testEmail,
                password: hashedPassword,
                name: 'Test User',
                role: 'EMPLOYEE',
                updatedAt: new Date()
            }
        });
        
        console.log('✅ User created successfully:', user.id);

        // Test 3: Try to create employee without image
        console.log('\n3. Testing employee creation without image...');
        const testEmployeeId = crypto.randomUUID();
        
        const employee = await prisma.employees.create({
            data: {
                id: testEmployeeId,
                userId: user.id,
                dni: Math.floor(10000000 + Math.random() * 90000000).toString(),
                firstName: 'Test',
                lastName: 'Employee',
                birthDate: new Date('1990-01-15'),
                hireDate: new Date(),
                areaId: areas[0].id,
                position: 'Developer',
                phone: '+54 11 1234-5678',
                updatedAt: new Date()
            },
            include: {
                User: true,
                Area: true
            }
        });
        
        console.log('✅ Employee created successfully:', employee.id);

        // Test 4: Try to create employee WITH image path
        console.log('\n4. Testing employee creation WITH image path...');
        const testUserId2 = crypto.randomUUID();
        const testEmployeeId2 = crypto.randomUUID();
        const testEmail2 = `test-img-${Date.now()}@sgn.com`;
        
        const result = await prisma.$transaction(async (prisma) => {
            const user2 = await prisma.user.create({
                data: {
                    id: testUserId2,
                    email: testEmail2,
                    password: hashedPassword,
                    name: 'Test User 2',
                    role: 'EMPLOYEE',
                    updatedAt: new Date()
                }
            });

            const employeeData = {
                id: testEmployeeId2,
                userId: user2.id,
                dni: Math.floor(10000000 + Math.random() * 90000000).toString(),
                firstName: 'Test',
                lastName: 'Employee2',
                birthDate: new Date('1990-01-15'),
                hireDate: new Date(),
                areaId: areas[0].id,
                position: 'Developer',
                phone: '+54 11 1234-5678',
                updatedAt: new Date(),
                profileImage: '/uploads/test-image-path.png'  // Simulated image path
            };

            const employee2 = await prisma.employees.create({
                data: employeeData,
                include: {
                    User: true,
                    Area: true
                }
            });

            return employee2;
        });
        
        console.log('✅ Employee with image path created successfully:', result.id);
        console.log('Profile image path:', result.profileImage);

        // Test 5: Check if we can query the employees
        console.log('\n5. Testing employee query...');
        const allEmployees = await prisma.employees.findMany({
            include: {
                User: {
                    select: { email: true, role: true }
                },
                Area: true
            }
        });
        
        console.log('Total employees in database:', allEmployees.length);

        // Cleanup test data
        console.log('\n6. Cleaning up test data...');
        await prisma.employees.deleteMany({
            where: {
                id: { in: [testEmployeeId, testEmployeeId2] }
            }
        });
        
        await prisma.user.deleteMany({
            where: {
                id: { in: [testUserId, testUserId2] }
            }
        });
        
        console.log('✅ Test data cleaned up');

    } catch (error) {
        console.error('\n💥 === DATABASE ERROR ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error code:', error.code);
        console.error('Error meta:', error.meta);
        console.error('Full error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

debugDatabaseError();

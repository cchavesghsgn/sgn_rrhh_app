
const fs = require('fs');

async function testEmployeeCreationPostSave() {
    console.log('🔍 === TESTING POST-SAVE ERROR ===');
    
    try {
        // Step 1: Login as admin (simulate browser login)
        console.log('\n1. Attempting to create session...');
        
        // Let's try to create employee without login first to see auth error
        console.log('\n2. Testing employee creation without proper auth...');
        
        // Create a simple test with JSON (no image first)
        const testData = {
            email: `test-employee-${Date.now()}@sgn.com`,
            password: 'password123',
            dni: Math.floor(10000000 + Math.random() * 90000000).toString(),
            firstName: 'Test',
            lastName: 'Employee',
            birthDate: '1990-01-15',
            hireDate: new Date().toISOString().split('T')[0],
            areaId: 'test-area-id',
            position: 'Developer',
            phone: '+54 11 1234-5678',
            role: 'EMPLOYEE'
        };

        const createResponse = await fetch('http://localhost:3000/api/employees', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(testData)
        });

        console.log('\n🔍 === RESPONSE ANALYSIS ===');
        console.log('Response status:', createResponse.status);
        console.log('Response headers:', Object.fromEntries(createResponse.headers.entries()));
        
        if (createResponse.ok) {
            console.log('✅ Response status is OK');
            const responseData = await createResponse.json();
            console.log('Response data:', JSON.stringify(responseData, null, 2));
        } else {
            console.log('❌ Response status indicates error');
            try {
                const errorData = await createResponse.json();
                console.log('Error response:', errorData);
            } catch (e) {
                const errorText = await createResponse.text();
                console.log('Error response (text):', errorText);
            }
        }

        // Step 3: Check server logs for any errors
        console.log('\n3. Checking recent server logs...');
        
    } catch (error) {
        console.error('\n💥 === COMPREHENSIVE ERROR ===');
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
    }
}

// Wait for server to start
setTimeout(() => {
    testEmployeeCreationPostSave();
}, 3000);


const http = require('http');
const https = require('https');

// Test function to login and test employee edit
async function testEmployeeEdit() {
  console.log('🧪 Testing Employee Edit Functionality...\n');

  try {
    // Step 1: Login to get session cookie
    console.log('1. Logging in...');
    
    const loginData = JSON.stringify({
      email: 'john@doe.com',
      password: 'johndoe123'
    });

    const loginOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/auth/callback/credentials',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': loginData.length
      }
    };

    const loginResult = await makeRequest(loginOptions, loginData);
    console.log('   Login response status:', loginResult.statusCode);

    // Extract session cookies
    let cookies = '';
    if (loginResult.headers['set-cookie']) {
      cookies = loginResult.headers['set-cookie'].join('; ');
    }

    // Step 2: Get first employee
    console.log('\n2. Getting first employee...');
    
    const getEmployeesOptions = {
      hostname: 'localhost',
      port: 3000,
      path: '/api/employees',
      method: 'GET',
      headers: {
        'Cookie': cookies
      }
    };

    const employeesResult = await makeRequest(getEmployeesOptions);
    console.log('   Get employees response status:', employeesResult.statusCode);
    
    let employeeId = null;
    if (employeesResult.statusCode === 200) {
      const employees = JSON.parse(employeesResult.body);
      if (employees.length > 0) {
        employeeId = employees[0].id;
        console.log('   Found employee ID:', employeeId);
      }
    }

    if (!employeeId) {
      console.log('❌ No employees found to test with');
      return;
    }

    // Step 3: Test employee update with FormData (simulating image upload scenario)
    console.log('\n3. Testing employee update with FormData...');
    
    const boundary = '----formdata-test-boundary';
    const formData = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="email"',
      '',
      'john@doe.com',
      `--${boundary}`,
      'Content-Disposition: form-data; name="dni"',
      '',
      '12345678',
      `--${boundary}`,
      'Content-Disposition: form-data; name="firstName"',
      '',
      'John',
      `--${boundary}`,
      'Content-Disposition: form-data; name="lastName"',
      '',
      'Doe',
      `--${boundary}`,
      'Content-Disposition: form-data; name="birthDate"',
      '',
      '1990-01-01',
      `--${boundary}`,
      'Content-Disposition: form-data; name="hireDate"',
      '',
      '2020-01-01',
      `--${boundary}`,
      'Content-Disposition: form-data; name="areaId"',
      '',
      'area1',
      `--${boundary}`,
      'Content-Disposition: form-data; name="position"',
      '',
      'Test Position Updated',
      `--${boundary}`,
      'Content-Disposition: form-data; name="phone"',
      '',
      '+54 11 1234-5678',
      `--${boundary}`,
      'Content-Disposition: form-data; name="role"',
      '',
      'ADMIN',
      `--${boundary}--`
    ].join('\r\n');

    const updateOptions = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/employees/${employeeId}`,
      method: 'PUT',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': Buffer.byteLength(formData),
        'Cookie': cookies
      }
    };

    const updateResult = await makeRequest(updateOptions, formData);
    console.log('   Update employee response status:', updateResult.statusCode);
    console.log('   Update employee response body:', updateResult.body);

    if (updateResult.statusCode === 200) {
      console.log('✅ Employee update with FormData successful!');
    } else {
      console.log('❌ Employee update failed');
    }

    // Step 4: Test with JSON data (without image)
    console.log('\n4. Testing employee update with JSON...');
    
    const jsonUpdateData = JSON.stringify({
      email: 'john@doe.com',
      dni: '12345678',
      firstName: 'John',
      lastName: 'Doe',
      birthDate: '1990-01-01',
      hireDate: '2020-01-01',
      areaId: 'area1',
      position: 'Test Position JSON',
      phone: '+54 11 1234-5678',
      role: 'ADMIN'
    });

    const jsonUpdateOptions = {
      hostname: 'localhost',
      port: 3000,
      path: `/api/employees/${employeeId}`,
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': jsonUpdateData.length,
        'Cookie': cookies
      }
    };

    const jsonUpdateResult = await makeRequest(jsonUpdateOptions, jsonUpdateData);
    console.log('   JSON update response status:', jsonUpdateResult.statusCode);
    console.log('   JSON update response body:', jsonUpdateResult.body);

    if (jsonUpdateResult.statusCode === 200) {
      console.log('✅ Employee update with JSON successful!');
    } else {
      console.log('❌ Employee update with JSON failed');
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

function makeRequest(options, postData = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => {
        body += chunk;
      });
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: body
        });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    if (postData) {
      req.write(postData);
    }
    
    req.end();
  });
}

// Run the test
testEmployeeEdit();

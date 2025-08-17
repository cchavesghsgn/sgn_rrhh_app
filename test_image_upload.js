
const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: false, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  
  try {
    console.log('Navegando a la página de login...');
    await page.goto('http://localhost:3000/login');
    
    // Hacer login
    console.log('Rellenando formulario de login...');
    await page.type('input[name="email"]', 'john@doe.com');
    await page.type('input[name="password"]', 'johndoe123');
    await page.click('button[type="submit"]');
    
    // Esperar a ser redirigido
    await page.waitForNavigation();
    console.log('Login exitoso, navegando a crear empleado...');
    
    // Navegar a crear empleado
    await page.goto('http://localhost:3000/admin/employees/new');
    await page.waitForSelector('form');
    
    console.log('Rellenando formulario de empleado...');
    // Rellenar campos
    await page.type('input[name="email"]', 'test@example.com');
    await page.type('input[name="password"]', 'testpassword');
    await page.type('input[name="confirmPassword"]', 'testpassword');
    await page.type('input[name="dni"]', '12345678');
    await page.type('input[name="firstName"]', 'Test');
    await page.type('input[name="lastName"]', 'User');
    await page.type('input[name="birthDate"]', '1990-01-01');
    await page.type('input[name="hireDate"]', '2024-01-01');
    await page.type('input[name="position"]', 'Developer');
    
    // Seleccionar área (si existe)
    try {
      const areaSelect = await page.waitForSelector('[data-testid="area-select"]', { timeout: 2000 });
      if (areaSelect) {
        await page.click('[data-testid="area-select"]');
        await page.waitForTimeout(500);
        const firstOption = await page.$('[data-testid="area-option"]:first-child');
        if (firstOption) await firstOption.click();
      }
    } catch (e) {
      console.log('No se pudo seleccionar área, continuando...');
    }
    
    // Crear una imagen de prueba pequeña
    const testImagePath = '/tmp/test-image.png';
    const canvas = require('canvas').createCanvas(100, 100);
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = '#ff0000';
    ctx.fillRect(0, 0, 100, 100);
    const buffer = canvas.toBuffer('image/png');
    fs.writeFileSync(testImagePath, buffer);
    
    // Subir imagen
    console.log('Subiendo imagen de prueba...');
    const fileInput = await page.$('input[type="file"]');
    if (fileInput) {
      await fileInput.uploadFile(testImagePath);
      await page.waitForTimeout(1000);
    }
    
    // Capturar requests de red
    page.on('response', response => {
      if (response.url().includes('/api/employees')) {
        console.log(`API Response: ${response.status()} - ${response.url()}`);
      }
    });
    
    console.log('Enviando formulario...');
    await page.click('button[type="submit"]');
    
    // Esperar respuesta
    await page.waitForTimeout(5000);
    
    // Verificar si hay errores en la consola
    const errors = await page.evaluate(() => {
      return window.localStorage.getItem('errors') || 'No errors';
    });
    
    console.log('Test completado. Errores:', errors);
    
  } catch (error) {
    console.error('Error durante la prueba:', error);
  } finally {
    await browser.close();
  }
})();

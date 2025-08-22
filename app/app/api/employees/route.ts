
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const employees = await prisma.employees.findMany({
      include: {
        User: {
          select: { email: true, role: true }
        },
        Area: true,
        leave_requests: {
          orderBy: { createdAt: 'desc' },
          take: 5
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format response to match frontend expectations (lowercase field names)
    const formattedEmployees = employees.map((employee: any) => ({
      ...employee,
      user: employee.User, // Lowercase for frontend compatibility
      area: employee.Area, // Lowercase for frontend compatibility
      User: undefined, // Remove uppercase version
      Area: undefined  // Remove uppercase version
    }));

    return NextResponse.json(formattedEmployees);
  } catch (error) {
    console.error('Get employees error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('=== EMPLOYEE CREATION API CALLED ===');
    
    console.log('1. Checking authentication...');
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      console.log('❌ No session found');
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      console.log('❌ User is not admin:', session.user.role);
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }
    
    console.log('✅ Authentication passed for user:', session.user.email);

    // Handle both FormData and JSON
    let data: any;
    let profileImage: File | null = null;

    const contentType = request.headers.get('content-type') || '';
    
    // Try to handle as FormData first, then fallback to JSON
    console.log('2. Processing request with content-type:', contentType);
    
    try {
      if (contentType.includes('multipart/form-data') || contentType.includes('form-data')) {
        // Handle FormData (when image is included)
        console.log('3. Parsing as FormData...');
        const formData = await request.formData();
        
        // Log all form data keys for debugging
        console.log('4. FormData keys:', Array.from(formData.keys()));
        console.log('5. FormData values preview:', {
          email: formData.get('email'),
          dni: formData.get('dni'),
          firstName: formData.get('firstName'),
          lastName: formData.get('lastName'),
          hasProfileImage: !!formData.get('profileImage')
        });
        
        data = {
          email: formData.get('email') as string,
          password: formData.get('password') as string,
          dni: formData.get('dni') as string,
          firstName: formData.get('firstName') as string,
          lastName: formData.get('lastName') as string,
          birthDate: formData.get('birthDate') as string,
          hireDate: formData.get('hireDate') as string,
          areaId: formData.get('areaId') as string,
          position: formData.get('position') as string,
          phone: formData.get('phone') as string,
          role: formData.get('role') as string || 'EMPLOYEE',
          vacationDays: formData.get('vacationDays') as string,
          personalHours: formData.get('personalHours') as string,
          remoteHours: formData.get('remoteHours') as string,
          availableHours: formData.get('availableHours') as string
        };

        // Get profile image if uploaded
        console.log('6. Processing profile image...');
        const imageFile = formData.get('profileImage');
        console.log('7. Image file raw:', {
          exists: !!imageFile,
          type: typeof imageFile,
          constructor: imageFile?.constructor?.name,
          size: (imageFile as any)?.size
        });
        
        if (imageFile && imageFile !== 'undefined' && typeof imageFile !== 'string') {
          // Ensure it's a file-like object with size
          if (imageFile instanceof File || (imageFile as any).size > 0) {
            profileImage = imageFile as File;
            console.log('8. ✅ Profile image accepted');
          } else {
            console.log('8. ❌ Profile image rejected - invalid size or type');
          }
        } else {
          console.log('8. ❌ No valid profile image found');
        }
      } else {
        // Handle JSON
        console.log('3. Parsing as JSON...');
        data = await request.json();
      }
    } catch (formDataError) {
      console.log('FormData parsing failed, trying JSON...', formDataError);
      try {
        // Fallback to JSON if FormData parsing fails
        data = await request.json();
      } catch (jsonError) {
        console.error('Both FormData and JSON parsing failed:', { formDataError, jsonError });
        return NextResponse.json(
          { error: 'Formato de datos inválido' },
          { status: 400 }
        );
      }
    }

    console.log('9. Extracting data from parsed input...');
    const {
      email,
      password,
      dni,
      firstName,
      lastName,
      birthDate,
      hireDate,
      areaId,
      position,
      phone,
      role = 'EMPLOYEE',
      vacationDays = 0,
      personalHours = 0,
      remoteHours = 0,
      availableHours = 0
    } = data;

    // Log received data for debugging
    console.log('10. ✅ Received employee creation data:', {
      email,
      dni,
      firstName,
      lastName,
      birthDate,
      hireDate,
      areaId,
      position,
      hasPassword: !!password,
      hasImage: !!profileImage,
      phone,
      role,
      vacationDays,
      personalHours,
      remoteHours,
      availableHours
    });

    // Validate required fields
    if (!email || !password || !dni || !firstName || !lastName || !birthDate || !hireDate || !areaId || !position) {
      console.error('Missing required fields:', {
        email: !!email,
        password: !!password,
        dni: !!dni,
        firstName: !!firstName,
        lastName: !!lastName,
        birthDate: !!birthDate,
        hireDate: !!hireDate,
        areaId: !!areaId,
        position: !!position
      });
      return NextResponse.json(
        { error: 'Todos los campos requeridos deben ser completados' },
        { status: 400 }
      );
    }

    // Check if user email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email }
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'El email ya está registrado' },
        { status: 400 }
      );
    }

    // Check if DNI already exists
    const existingEmployee = await prisma.employees.findUnique({
      where: { dni }
    });

    if (existingEmployee) {
      return NextResponse.json(
        { error: 'El DNI ya está registrado' },
        { status: 400 }
      );
    }

    // Generate employee ID first (needed for image filename)
    const employeeId = crypto.randomUUID();

    // Handle profile image upload
    let profileImagePath: string | null = null;

    if (profileImage) {
      try {
        console.log('Processing profile image:', {
          name: profileImage.name || 'unknown',
          size: (profileImage as any).size || 'unknown',
          type: profileImage.type || 'unknown'
        });

        // Ensure uploads directory exists
        const uploadsDir = path.join(process.cwd(), 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });
        
        // Generate unique filename with fallback for extension
        let fileExtension = 'png'; // default extension
        if (profileImage.name && profileImage.name.includes('.')) {
          fileExtension = profileImage.name.split('.').pop() || 'png';
        } else if (profileImage.type) {
          // Extract extension from MIME type (e.g., "image/jpeg" -> "jpeg")
          fileExtension = profileImage.type.split('/').pop() || 'png';
        }
        
        const fileName = `employee-${employeeId}-${Date.now()}.${fileExtension}`;
        profileImagePath = `/uploads/${fileName}`;
        
        // Save file - handle both File and Blob-like objects
        let buffer: Buffer;
        
        if (typeof profileImage.arrayBuffer === 'function') {
          const bytes = await profileImage.arrayBuffer();
          buffer = Buffer.from(bytes);
        } else if ((profileImage as any).stream) {
          // Handle stream-like objects
          const chunks: Uint8Array[] = [];
          const reader = (profileImage as any).stream().getReader();
          let done = false;
          
          while (!done) {
            const { value, done: streamDone } = await reader.read();
            done = streamDone;
            if (value) chunks.push(value);
          }
          
          buffer = Buffer.concat(chunks);
        } else {
          throw new Error('Unable to read image data from profileImage object');
        }
        
        await fs.writeFile(path.join(uploadsDir, fileName), buffer);
        
        console.log('Profile image saved successfully:', {
          path: profileImagePath,
          size: buffer.length,
          fileName
        });
      } catch (imageError) {
        console.error('Error saving profile image:', imageError);
        console.error('ProfileImage object:', {
          type: typeof profileImage,
          constructor: profileImage.constructor?.name,
          keys: Object.keys(profileImage || {}),
          name: (profileImage as any).name,
          size: (profileImage as any).size
        });
        // Continue without image if upload fails
      }
    }

    console.log('11. Starting database transaction...');
    
    // Validate area exists before transaction
    console.log('12. Validating area exists:', areaId);
    const areaExists = await prisma.area.findUnique({
      where: { id: areaId }
    });
    
    if (!areaExists) {
      console.error('❌ Area not found:', areaId);
      return NextResponse.json(
        { error: 'El área seleccionada no existe' },
        { status: 400 }
      );
    }
    console.log('✅ Area validation passed:', areaExists.name);

    // Validate and parse dates
    console.log('13. Validating dates...');
    let parsedBirthDate: Date;
    let parsedHireDate: Date;
    
    try {
      parsedBirthDate = new Date(birthDate);
      parsedHireDate = new Date(hireDate);
      
      // Check if dates are valid
      if (isNaN(parsedBirthDate.getTime())) {
        throw new Error('Invalid birth date');
      }
      if (isNaN(parsedHireDate.getTime())) {
        throw new Error('Invalid hire date');
      }
      
      console.log('✅ Date validation passed:', {
        birthDate: parsedBirthDate.toISOString(),
        hireDate: parsedHireDate.toISOString()
      });
    } catch (dateError) {
      console.error('❌ Date validation failed:', dateError);
      return NextResponse.json(
        { error: 'Fechas inválidas proporcionadas' },
        { status: 400 }
      );
    }

    // Create user and employee in a transaction
    console.log('14. Hashing password...');
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);
    console.log('✅ Password hashed successfully');

    console.log('15. Starting Prisma transaction...');
    const result = await prisma.$transaction(async (transactionPrisma: any) => {
      console.log('16. Creating user in transaction...');
      const user = await transactionPrisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email,
          password: hashedPassword,
          name: `${firstName} ${lastName}`,
          role,
          updatedAt: new Date()
        }
      });
      console.log('✅ User created in transaction:', user.id);

      // Prepare employee data
      console.log('17. Preparing employee data...');
      const employeeData: any = {
        id: employeeId,
        dni,
        firstName,
        lastName,
        birthDate: parsedBirthDate,
        hireDate: parsedHireDate,
        User: {
          connect: {
            id: user.id
          }
        },
        Area: {
          connect: {
            id: areaId
          }
        },
        position,
        phone: phone || null,
        vacationDays: Number(vacationDays),
        personalHours: Number(personalHours),
        remoteHours: Number(remoteHours),
        availableHours: Number(availableHours),
        totalVacationDays: Number(vacationDays),
        totalPersonalHours: Number(personalHours),
        totalRemoteHours: Number(remoteHours),
        totalAvailableHours: Number(availableHours),
        updatedAt: new Date()
      };

      // Add profile image path if uploaded
      if (profileImagePath) {
        employeeData.profileImage = profileImagePath;
        console.log('✅ Profile image path added to employee data:', profileImagePath);
      }

      console.log('18. Creating employee in transaction...');
      const employee = await transactionPrisma.employees.create({
        data: employeeData,
        include: {
          User: true,
          Area: true
        }
      });
      console.log('✅ Employee created in transaction:', employee.id);

      return employee;
    });

    console.log('19. ✅ Transaction completed successfully');
    console.log('20. Preparing response...');
    
    // Format response to match frontend expectations
    const formattedResult = {
      ...result,
      user: result.User, // Lowercase for frontend compatibility
      area: result.Area, // Lowercase for frontend compatibility
      User: undefined, // Remove uppercase version
      Area: undefined  // Remove uppercase version
    };

    console.log('21. ✅ Response formatted, sending to client...');
    return NextResponse.json(formattedResult, { status: 201 });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import path from 'path';
import fs from 'fs/promises';
import { putObject, buildKey } from '@/lib/s3';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

// Normalize DB enum -> App enum
const fromDbType = (t: string) => {
  switch (t) {
    case 'License': return 'LICENSE';
    case 'Personal': return 'PERSONAL';
    case 'Remote': return 'REMOTE';
    case 'Hours': return 'HOURS';
    default: return t;
  }
};

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
      // Normalize nested leave_requests.type to UPPERCASE for UI logic
      leave_requests: Array.isArray(employee.leave_requests)
        ? employee.leave_requests.map((lr: any) => ({ ...lr, type: fromDbType(lr.type) }))
        : employee.leave_requests,
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

    console.log('✅ Authentication passed for user:', session.user?.email || 'unknown');

    // Prepare containers
    let data: any = {};
    let profileImage: File | null = null;

    const contentType = request.headers.get('content-type') || '';
    console.log('2. Content-Type:', contentType);

    // Parse request: prefer FormData when multipart, otherwise JSON
    try {
      if (contentType.includes('multipart/form-data')) {
        console.log('3. Parsing as FormData...');
        const formData = await request.formData();

        // Map expected fields
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
          role: (formData.get('role') as string) || 'EMPLOYEE',
          vacationDays: formData.get('vacationDays') as string,
          personalHours: formData.get('personalHours') as string,
          remoteHours: formData.get('remoteHours') as string,
          availableHours: formData.get('availableHours') as string
        };

        // Extract image if provided
        const imageFile = formData.get('profileImage');
        if (imageFile && imageFile !== 'undefined' && typeof imageFile !== 'string') {
          if ((imageFile as any).size || imageFile instanceof File) {
            profileImage = imageFile as File;
            console.log('4. Profile image found:', {
              name: (profileImage as any).name,
              size: (profileImage as any).size,
              type: (profileImage as any).type
            });
          } else {
            console.log('4. Profile image present but invalid shape');
          }
        } else {
          console.log('4. No profile image provided');
        }
      } else {
        console.log('3. Parsing as JSON...');
        data = await request.json();
      }
    } catch (parseError) {
      console.warn('FormData parsing failed, attempting JSON fallback...', parseError);
      try {
        data = await request.json();
      } catch (jsonError) {
        console.error('Both FormData and JSON parsing failed:', { parseError, jsonError });
        return NextResponse.json({ error: 'Formato de datos inválido' }, { status: 400 });
      }
    }

    // Destructure and set defaults
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

    console.log('5. Parsed data preview:', {
      email,
      dni,
      firstName,
      lastName,
      hasPassword: !!password,
      hasImage: !!profileImage,
      phone,
      role
    });

    // Validate required fields
    if (!email || !password || !dni || !firstName || !lastName || !birthDate || !hireDate || !areaId || !position) {
      console.error('6. Missing required fields', {
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

    // Check for existing email
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return NextResponse.json({ error: 'El email ya está registrado' }, { status: 400 });
    }

    // Check for existing DNI
    const existingEmployee = await prisma.employees.findUnique({ where: { dni } });
    if (existingEmployee) {
      return NextResponse.json({ error: 'El DNI ya está registrado' }, { status: 400 });
    }

    // Generate employee ID (used for image filename)
    const employeeId = crypto.randomUUID();
    console.log('7. Generated employee ID:', employeeId);

    // Prepare for potential image save
    let profileImagePath: string | null = null;

    if (profileImage) {
      try {
        console.log('8. Preparing to save profile image...', {
          name: (profileImage as any).name,
          size: (profileImage as any).size,
          type: (profileImage as any).type
        });

        // Basic validations
        const mime = (profileImage as any).type || '';
        if (!mime.startsWith('image/')) {
          console.warn('8. Not an image MIME type, skipping image save:', mime);
          throw new Error('Invalid image MIME type');
        }
        const maxSize = 5 * 1024 * 1024; // 5MB
        if ((profileImage as any).size > maxSize) {
          console.warn('8. Image too large, skipping image save:', (profileImage as any).size);
          throw new Error('Image exceeds maximum size');
        }

        // Determine extension and filename
        let fileExtension = 'jpg';
        const originalName = (profileImage as any).name || '';
        if (originalName.includes('.')) {
          fileExtension = originalName.split('.').pop() || fileExtension;
        } else if (mime.includes('/')) {
          fileExtension = mime.split('/').pop() || fileExtension;
        }
        const fileName = `employee-${employeeId}-${Date.now()}.${fileExtension}`;
        // Read data and upload to S3
        const bytes = await (profileImage as any).arrayBuffer();
        const buffer = Buffer.from(bytes);
        const key = buildKey(`profile/${fileName}`);
        await putObject(key, buffer, mime || 'application/octet-stream');

        profileImagePath = `/api/files/profile/${fileName}`;
        console.log('8. Image uploaded to S3, path', profileImagePath);
      } catch (imageError) {
        // Log error, but do not fail the whole request — continue without image
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
        employeeData.photo = profileImagePath;
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


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
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // Handle both FormData and JSON
    let data: any;
    let profileImage: File | null = null;

    const contentType = request.headers.get('content-type') || '';
    
    // Try to handle as FormData first, then fallback to JSON
    try {
      if (contentType.includes('multipart/form-data') || contentType.includes('form-data')) {
        // Handle FormData (when image is included)
        const formData = await request.formData();
        
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
          role: formData.get('role') as string || 'EMPLOYEE'
        };

        // Get profile image if uploaded
        const imageFile = formData.get('profileImage') as File;
        if (imageFile && imageFile.size > 0) {
          profileImage = imageFile;
        }
      } else {
        // Handle JSON
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
      role = 'EMPLOYEE'
    } = data;

    // Log received data for debugging
    console.log('Received employee creation data:', {
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
      phone
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
        // Ensure uploads directory exists
        const uploadsDir = path.join(process.cwd(), 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });
        
        // Generate unique filename
        const fileExtension = profileImage.name.split('.').pop();
        const fileName = `employee-${employeeId}-${Date.now()}.${fileExtension}`;
        profileImagePath = `/uploads/${fileName}`;
        
        // Save file
        const bytes = await profileImage.arrayBuffer();
        const buffer = Buffer.from(bytes);
        await fs.writeFile(path.join(uploadsDir, fileName), buffer);
        
        console.log('Profile image saved:', profileImagePath);
      } catch (imageError) {
        console.error('Error saving profile image:', imageError);
        // Continue without image if upload fails
      }
    }

    // Create user and employee in a transaction
    const bcrypt = require('bcryptjs');
    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await prisma.$transaction(async (prisma: any) => {
      const user = await prisma.user.create({
        data: {
          id: crypto.randomUUID(),
          email,
          password: hashedPassword,
          name: `${firstName} ${lastName}`,
          role,
          updatedAt: new Date()
        }
      });

      // Prepare employee data
      const employeeData: any = {
        id: employeeId,
        userId: user.id,
        dni,
        firstName,
        lastName,
        birthDate: new Date(birthDate),
        hireDate: new Date(hireDate),
        areaId,
        position,
        phone: phone || null,
        updatedAt: new Date()
      };

      // Add profile image path if uploaded
      if (profileImagePath) {
        employeeData.profileImage = profileImagePath;
      }

      const employee = await prisma.employees.create({
        data: employeeData,
        include: {
          User: true,
          Area: true
        }
      });

      return employee;
    });

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error('Create employee error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

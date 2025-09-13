

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import path from 'path';
import fs from 'fs/promises';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const employee = await prisma.employees.findUnique({
      where: { id: params.id },
      include: {
        User: {
          select: { email: true, role: true }
        },
        Area: true,
        leave_requests: {
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!employee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Format response to match frontend expectations (lowercase field names)
    const formattedEmployee = {
      ...employee,
      user: employee.User, // Lowercase for frontend compatibility
      area: employee.Area, // Lowercase for frontend compatibility
      User: undefined, // Remove uppercase version
      Area: undefined  // Remove uppercase version
    };

    return NextResponse.json(formattedEmployee);
  } catch (error) {
    console.error('Get employee error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
          dni: formData.get('dni') as string,
          firstName: formData.get('firstName') as string,
          lastName: formData.get('lastName') as string,
          birthDate: formData.get('birthDate') as string,
          hireDate: formData.get('hireDate') as string,
          areaId: formData.get('areaId') as string,
          position: formData.get('position') as string,
          phone: formData.get('phone') as string,
          role: formData.get('role') as string,
          vacationDays: formData.get('vacationDays') as string,
          personalHours: formData.get('personalHours') as string,
          remoteHours: formData.get('remoteHours') as string,
          availableHours: formData.get('availableHours') as string
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
      dni,
      firstName,
      lastName,
      birthDate,
      hireDate,
      areaId,
      position,
      phone,
      role,
      vacationDays,
      personalHours,
      remoteHours,
      availableHours
    } = data;

    // Validate required fields
    if (!email || !dni || !firstName || !lastName || !birthDate || !hireDate || !areaId || !position) {
      return NextResponse.json(
        { error: 'Todos los campos requeridos deben ser completados' },
        { status: 400 }
      );
    }

    // Check if employee exists
    const existingEmployee = await prisma.employees.findUnique({
      where: { id: params.id },
      include: { User: true }
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Check if email is already used by another user
    if (email !== existingEmployee.User.email) {
      const existingUser = await prisma.user.findUnique({
        where: { email }
      });

      if (existingUser && existingUser.id !== existingEmployee.userId) {
        return NextResponse.json(
          { error: 'El email ya está registrado por otro usuario' },
          { status: 400 }
        );
      }
    }

    // Check if DNI is already used by another employee
    if (dni !== existingEmployee.dni) {
      const existingDNIEmployee = await prisma.employees.findUnique({
        where: { dni }
      });

      if (existingDNIEmployee && existingDNIEmployee.id !== params.id) {
        return NextResponse.json(
          { error: 'El DNI ya está registrado por otro empleado' },
          { status: 400 }
        );
      }
    }

    // Handle profile image upload
    let profileImagePath: string | null = null;

    if (profileImage) {
      try {
        // Ensure uploads directory exists in public folder
        const uploadsDir = path.join(process.cwd(), 'public', 'uploads');
        await fs.mkdir(uploadsDir, { recursive: true });

        // Generate unique filename
        const fileExtension = profileImage.name.split('.').pop();
        const fileName = `employee-${params.id}-${Date.now()}.${fileExtension}`;
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

    // Update employee and user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Update user
      await tx.user.update({
        where: { id: existingEmployee.userId },
        data: {
          email,
          name: `${firstName} ${lastName}`,
          role: role || existingEmployee.User.role
        }
      });

      // Prepare employee update data
      const employeeUpdateData: any = {
        dni,
        firstName,
        lastName,
        birthDate: new Date(birthDate),
        hireDate: new Date(hireDate),
        Area: {
          connect: {
            id: areaId
          }
        },
        position,
        phone: phone || null
      };

      // Add vacation and hours data if provided (apply delta logic to preserve usage)
      // Vacations (days)
      if (vacationDays !== undefined) {
        const newTotalDays = Number(vacationDays);
        const prevTotalDays = existingEmployee.totalVacationDays || 0;
        const deltaDays = newTotalDays - prevTotalDays;

        employeeUpdateData.totalVacationDays = newTotalDays;
        employeeUpdateData.vacationDays = Math.max(
          0,
          Math.min(newTotalDays, (existingEmployee.vacationDays || 0) + deltaDays)
        );
      }

      // Personal days (stored as hours)
      if (personalHours !== undefined) {
        const newTotalHours = Number(personalHours);
        const prevTotalHours = existingEmployee.totalPersonalHours || 0;
        const delta = newTotalHours - prevTotalHours;

        employeeUpdateData.totalPersonalHours = newTotalHours;
        employeeUpdateData.personalHours = Math.max(
          0,
          Math.min(newTotalHours, (existingEmployee.personalHours || 0) + delta)
        );
      }

      // Remote days (stored as hours)
      if (remoteHours !== undefined) {
        const newTotalHours = Number(remoteHours);
        const prevTotalHours = existingEmployee.totalRemoteHours || 0;
        const delta = newTotalHours - prevTotalHours;

        employeeUpdateData.totalRemoteHours = newTotalHours;
        employeeUpdateData.remoteHours = Math.max(
          0,
          Math.min(newTotalHours, (existingEmployee.remoteHours || 0) + delta)
        );
      }

      // Hours bucket used by type HOURS requests (stored as hours)
      if (availableHours !== undefined) {
        const newTotalHours = Number(availableHours);
        const prevTotalHours = existingEmployee.totalAvailableHours || 0;
        const delta = newTotalHours - prevTotalHours;

        employeeUpdateData.totalAvailableHours = newTotalHours;
        employeeUpdateData.availableHours = Math.max(
          0,
          Math.min(newTotalHours, (existingEmployee.availableHours || 0) + delta)
        );
      }

      // Add profile image path if uploaded
      if (profileImagePath) {
        employeeUpdateData.photo = profileImagePath;
      }

      // Update employee
      const updatedEmployee = await tx.employees.update({
        where: { id: params.id },
        data: employeeUpdateData,
        include: {
          User: {
            select: { email: true, role: true }
          },
          Area: true
        }
      });

      return updatedEmployee;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Update employee error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    // No need for force parameter - always delete

    // Check if employee exists
    const existingEmployee = await prisma.employees.findUnique({
      where: { id: params.id },
      include: {
        User: true,
        leave_requests: true
      }
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Always proceed with deletion, regardless of leave requests

    // Delete employee, user and all leave requests in a transaction
    await prisma.$transaction(async (prisma: any) => {
      // Delete leave requests first
      if (existingEmployee.leave_requests.length > 0) {
        await prisma.leave_requests.deleteMany({
          where: { employeeId: params.id }
        });
      }

      // Delete employee (this will also delete related records due to cascade)
      await prisma.employees.delete({
        where: { id: params.id }
      });

      // Delete associated user
      await prisma.user.delete({
        where: { id: existingEmployee.userId }
      });
    });

    const message = existingEmployee.leave_requests.length > 0 
      ? `Empleado eliminado exitosamente junto con ${existingEmployee.leave_requests.length} solicitud(es) de licencia`
      : 'Empleado eliminado exitosamente';

    return NextResponse.json({ message });
  } catch (error) {
    console.error('Delete employee error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}



import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../../lib/auth';
import { PrismaClient } from '@prisma/client';

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

    const employee = await prisma.employee.findUnique({
      where: { id: params.id },
      include: {
        user: {
          select: { email: true, role: true }
        },
        area: true,
        leaveRequests: {
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

    return NextResponse.json(employee);
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

    const data = await request.json();
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
      role
    } = data;

    // Validate required fields
    if (!email || !dni || !firstName || !lastName || !birthDate || !hireDate || !areaId || !position) {
      return NextResponse.json(
        { error: 'Todos los campos requeridos deben ser completados' },
        { status: 400 }
      );
    }

    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: params.id },
      include: { user: true }
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // Check if email is already used by another user
    if (email !== existingEmployee.user.email) {
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
      const existingDNIEmployee = await prisma.employee.findUnique({
        where: { dni }
      });

      if (existingDNIEmployee && existingDNIEmployee.id !== params.id) {
        return NextResponse.json(
          { error: 'El DNI ya está registrado por otro empleado' },
          { status: 400 }
        );
      }
    }

    // Update employee and user in a transaction
    const result = await prisma.$transaction(async (prisma) => {
      // Update user
      await prisma.user.update({
        where: { id: existingEmployee.userId },
        data: {
          email,
          name: `${firstName} ${lastName}`,
          role: role || existingEmployee.user.role
        }
      });

      // Update employee
      const updatedEmployee = await prisma.employee.update({
        where: { id: params.id },
        data: {
          dni,
          firstName,
          lastName,
          birthDate: new Date(birthDate),
          hireDate: new Date(hireDate),
          areaId,
          position,
          phone: phone || null
        },
        include: {
          user: {
            select: { email: true, role: true }
          },
          area: true
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

    // Get force parameter from URL
    const url = new URL(request.url);
    const force = url.searchParams.get('force') === 'true';

    // Check if employee exists
    const existingEmployee = await prisma.employee.findUnique({
      where: { id: params.id },
      include: {
        user: true,
        leaveRequests: true
      }
    });

    if (!existingEmployee) {
      return NextResponse.json(
        { error: 'Empleado no encontrado' },
        { status: 404 }
      );
    }

    // If employee has leave requests and force is not true, return error with details
    if (existingEmployee.leaveRequests.length > 0 && !force) {
      return NextResponse.json(
        { 
          error: 'El empleado tiene solicitudes de licencia registradas',
          hasRequests: true,
          requestCount: existingEmployee.leaveRequests.length,
          message: 'Para eliminar este empleado y todas sus solicitudes, confirma la acción.'
        },
        { status: 409 }
      );
    }

    // Delete employee, user and all leave requests in a transaction
    await prisma.$transaction(async (prisma) => {
      // Delete leave requests first
      if (existingEmployee.leaveRequests.length > 0) {
        await prisma.leaveRequest.deleteMany({
          where: { employeeId: params.id }
        });
      }

      // Delete employee (this will also delete related records due to cascade)
      await prisma.employee.delete({
        where: { id: params.id }
      });

      // Delete associated user
      await prisma.user.delete({
        where: { id: existingEmployee.userId }
      });
    });

    const message = existingEmployee.leaveRequests.length > 0 
      ? `Empleado eliminado exitosamente junto con ${existingEmployee.leaveRequests.length} solicitud(es) de licencia`
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

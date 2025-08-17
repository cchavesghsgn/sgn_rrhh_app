
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

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

    // Handle JSON data
    const data = await request.json();

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

    // Validate required fields
    if (!email || !password || !dni || !firstName || !lastName || !birthDate || !hireDate || !areaId || !position) {
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

      const employee = await prisma.employees.create({
        data: {
          id: crypto.randomUUID(),
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
        },
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


import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');

    let whereClause: any = {};

    if (session.user.role === 'EMPLOYEE') {
      // Get user's employee record
      const employee = await prisma.employee.findUnique({
        where: { userId: session.user.id }
      });

      if (!employee) {
        return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
      }

      whereClause.employeeId = employee.id;
    }

    if (status) {
      whereClause.status = status;
    }

    if (employeeId) {
      whereClause.employeeId = employeeId;
    }

    const leaveRequests = await prisma.leaveRequest.findMany({
      where: whereClause,
      include: {
        employee: {
          include: {
            area: true,
            user: true
          }
        },
        attachments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(leaveRequests);
  } catch (error) {
    console.error('Get leave requests error:', error);
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

    // Get user's employee record
    const employee = await prisma.employee.findUnique({
      where: { userId: session.user.id }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const { type, startDate, endDate, isHalfDay, hours, reason } = await request.json();

    // Validate required fields
    if (!type || !startDate || !endDate || !reason) {
      return NextResponse.json(
        { error: 'Todos los campos requeridos deben ser completados' },
        { status: 400 }
      );
    }

    // Validate hours field for HOURS type
    if (type === 'HOURS' && !hours) {
      return NextResponse.json(
        { error: 'Las horas son requeridas para solicitudes de horas' },
        { status: 400 }
      );
    }

    // Check available days/hours
    const start = new Date(startDate);
    const end = new Date(endDate);
    let daysRequested = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    if (isHalfDay && daysRequested === 1) {
      daysRequested = 0.5;
    }

    if (type === 'PERSONAL' && employee.personalDays < daysRequested) {
      return NextResponse.json(
        { error: `No tienes suficientes días personales disponibles. Disponibles: ${employee.personalDays}` },
        { status: 400 }
      );
    }

    if (type === 'REMOTE' && employee.remoteDays < daysRequested) {
      return NextResponse.json(
        { error: `No tienes suficientes días remotos disponibles. Disponibles: ${employee.remoteDays}` },
        { status: 400 }
      );
    }

    if (type === 'HOURS' && employee.availableHours < hours) {
      return NextResponse.json(
        { error: `No tienes suficientes horas disponibles. Disponibles: ${employee.availableHours}` },
        { status: 400 }
      );
    }

    const leaveRequest = await prisma.leaveRequest.create({
      data: {
        employeeId: employee.id,
        type,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        isHalfDay: isHalfDay || false,
        hours: type === 'HOURS' ? hours : null,
        reason,
        status: 'PENDING'
      },
      include: {
        employee: {
          include: {
            area: true,
            user: true
          }
        }
      }
    });

    return NextResponse.json(leaveRequest, { status: 201 });
  } catch (error) {
    console.error('Create leave request error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

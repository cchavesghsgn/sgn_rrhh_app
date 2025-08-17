
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

    const { type, startDate, endDate, isHalfDay, hours, startTime, endTime, shift, reason } = await request.json();

    // Validate required fields based on type
    if (!type || !startDate || !reason) {
      return NextResponse.json(
        { error: 'Todos los campos requeridos deben ser completados' },
        { status: 400 }
      );
    }

    // Type-specific validations
    if (type === 'HOURS') {
      if (!hours || (!startTime && !endTime)) {
        return NextResponse.json(
          { error: 'Para pedidos de horas se requiere cantidad de horas y horarios' },
          { status: 400 }
        );
      }
    } else if (type === 'PERSONAL' || type === 'REMOTE') {
      if (!shift) {
        return NextResponse.json(
          { error: 'Para días personales/remotos se requiere especificar el turno' },
          { status: 400 }
        );
      }
    } else if (type === 'LICENSE') {
      if (!endDate) {
        return NextResponse.json(
          { error: 'Para licencias se requiere fecha de inicio y fin' },
          { status: 400 }
        );
      }
    }

    // Check available days/hours based on type
    let daysRequested = 0;
    
    if (type === 'LICENSE' && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      daysRequested = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      if (isHalfDay && daysRequested === 1) {
        daysRequested = 0.5;
      }
    } else if (type === 'PERSONAL' || type === 'REMOTE') {
      // For personal/remote days, it's always 1 day but can be half day based on shift
      daysRequested = (shift === 'MORNING' || shift === 'AFTERNOON') ? 0.5 : 1;
    }

    // Validate available resources
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
        endDate: endDate ? new Date(endDate) : new Date(startDate), // Use startDate as endDate if not provided
        isHalfDay: isHalfDay || false,
        hours: type === 'HOURS' ? hours : null,
        startTime: type === 'HOURS' ? startTime : null,
        endTime: type === 'HOURS' ? endTime : null,
        shift: (type === 'PERSONAL' || type === 'REMOTE') ? shift : null,
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

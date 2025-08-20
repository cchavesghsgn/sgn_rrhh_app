
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { calculateHoursToDeduct, formatAvailableTime } from '../../../lib/time-utils';
import { sendNewRequestNotification, NewRequestEmailData } from '../../../lib/email';
import { LEAVE_REQUEST_TYPE_LABELS } from '../../../lib/types';
import crypto from 'crypto';

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
      const employee = await prisma.employees.findUnique({
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

    const leaveRequests = await prisma.leave_requests.findMany({
      where: whereClause,
      include: {
        employees: {
          include: {
            Area: true,
            User: true
          }
        },
        attachments: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // Format response to match frontend expectations (employee instead of employees)
    const formattedRequests = leaveRequests.map((request: any) => ({
      ...request,
      employee: request.employees ? {
        ...request.employees,
        user: request.employees.User,
        area: request.employees.Area
      } : null,
      employees: undefined // Remove the original
    }));

    return NextResponse.json(formattedRequests);
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
    const employee = await prisma.employees.findUnique({
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

    // Validate available resources using hours
    if (type === 'PERSONAL') {
      const hoursRequired = shift ? calculateHoursToDeduct(shift) : 8; // Default to full day
      if (employee.personalHours < hoursRequired) {
        return NextResponse.json(
          { error: `No tienes suficientes horas personales disponibles. Disponibles: ${formatAvailableTime(employee.personalHours)}` },
          { status: 400 }
        );
      }
    }

    if (type === 'REMOTE') {
      const hoursRequired = shift ? calculateHoursToDeduct(shift) : 8; // Default to full day
      if (employee.remoteHours < hoursRequired) {
        return NextResponse.json(
          { error: `No tienes suficientes horas remotas disponibles. Disponibles: ${formatAvailableTime(employee.remoteHours)}` },
          { status: 400 }
        );
      }
    }

    if (type === 'HOURS' && employee.availableHours < hours) {
      return NextResponse.json(
        { error: `No tienes suficientes horas disponibles. Disponibles: ${employee.availableHours}` },
        { status: 400 }
      );
    }

    const leaveRequest = await prisma.leave_requests.create({
      data: {
        id: crypto.randomUUID(),
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
        status: 'PENDING',
        updatedAt: new Date()
      },
      include: {
        employees: {
          include: {
            Area: true,
            User: true
          }
        }
      }
    });

    // Enviar notificación por correo a administradores
    try {
      // Obtener todos los administradores
      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
        select: { email: true }
      });

      if (admins.length > 0) {
        const adminEmails = admins.map((admin: any) => admin.email);
        
        // Formatear la fecha para mostrar
        let displayDate = new Date(startDate).toLocaleDateString('es-ES');
        if (endDate && endDate !== startDate) {
          displayDate += ` - ${new Date(endDate).toLocaleDateString('es-ES')}`;
        }

        // Si es solicitud de horas, agregar información del horario
        if (type === 'HOURS' && startTime && endTime) {
          displayDate += ` (${startTime}:00 - ${endTime}:00)`;
        }

        // Si tiene turno, agregarlo
        if (shift) {
          const shiftLabels = {
            'MORNING': 'Mañana',
            'AFTERNOON': 'Tarde', 
            'FULL_DAY': 'Todo el día'
          };
          displayDate += ` - ${shiftLabels[shift as keyof typeof shiftLabels] || shift}`;
        }

        const emailData: NewRequestEmailData = {
          employeeName: leaveRequest.employees.User.name || 'Usuario',
          employeeEmail: leaveRequest.employees.User.email,
          requestType: LEAVE_REQUEST_TYPE_LABELS[type as keyof typeof LEAVE_REQUEST_TYPE_LABELS] || type,
          requestDate: displayDate,
          reason: reason,
          requestId: leaveRequest.id
        };

        // Enviar correo de forma asíncrona para no bloquear la respuesta
        sendNewRequestNotification(adminEmails, emailData).catch(error => {
          console.error('Error enviando notificación por correo:', error);
        });
      }
    } catch (emailError) {
      console.error('Error preparando notificación por correo:', emailError);
      // No fallar la creación de la solicitud por errores de correo
    }

    // Format response to match frontend expectations (employee instead of employees)
    const formattedLeaveRequest = {
      ...leaveRequest,
      employee: leaveRequest.employees ? {
        ...leaveRequest.employees,
        user: leaveRequest.employees.User,
        area: leaveRequest.employees.Area
      } : null,
      employees: undefined // Remove the original
    };

    return NextResponse.json(formattedLeaveRequest, { status: 201 });
  } catch (error) {
    console.error('Create leave request error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

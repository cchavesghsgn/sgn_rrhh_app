
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { calculateHoursToDeduct, formatAvailableTime } from '../../../lib/time-utils';
import { sendNewRequestNotification, NewRequestEmailData } from '../../../lib/email';
import { LEAVE_REQUEST_TYPE_LABELS, LeaveRequestType } from '../../../lib/types';
import crypto from 'crypto';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

// Bridge enum mismatch: DB stores TitleCase values, app uses UPPERCASE
const toDbType = (t: string) => {
  switch (t) {
    case 'LICENSE': return 'License';
    case 'VACATION': return 'Vacation';
    case 'PERSONAL': return 'Personal';
    case 'REMOTE': return 'Remote';
    case 'HOURS': return 'Hours';
    default: return t;
  }
};

const fromDbType = (t: string) => {
  switch (t) {
    case 'License': return 'LICENSE';
    case 'Vacation': return 'VACATION';
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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');
    const scope = searchParams.get('scope'); // e.g., 'me'

    let whereClause: any = {};

    // Resolve current user's employee record if needed
    let currentEmployee: any = null;
    if (scope === 'me' || session.user.role === 'EMPLOYEE') {
      currentEmployee = await prisma.employees.findUnique({ where: { userId: session.user.id } });
    }

    // When scope=me, always filter by the current user's employee id (even for admins)
    if (scope === 'me') {
      if (!currentEmployee) {
        return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
      }
      whereClause.employeeId = currentEmployee.id;
    } else if (session.user.role === 'EMPLOYEE') {
      if (!currentEmployee) {
        return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
      }
      whereClause.employeeId = currentEmployee.id;
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
      type: fromDbType(request.type),
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
    
    if ((type === LeaveRequestType.LICENSE || type === LeaveRequestType.VACATION) && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      daysRequested = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      if (isHalfDay && daysRequested === 1) {
        daysRequested = 0.5;
      }
    } else if (type === LeaveRequestType.PERSONAL || type === LeaveRequestType.REMOTE) {
      // For personal/remote days, it's always 1 day but can be half day based on shift
      daysRequested = (shift === 'MORNING' || shift === 'AFTERNOON') ? 0.5 : 1;
    }

    // Validate available resources using hours
    if (type === LeaveRequestType.VACATION) {
      if (employee.vacationDays < daysRequested) {
        return NextResponse.json(
          { error: `No tienes suficientes días de vacaciones disponibles. Disponibles: ${employee.vacationDays} de ${employee.totalVacationDays || 20} días` },
          { status: 400 }
        );
      }
    }

    if (type === LeaveRequestType.PERSONAL) {
      const hoursRequired = shift ? calculateHoursToDeduct(shift) : 8; // Default to full day
      if (employee.personalHours < hoursRequired) {
        return NextResponse.json(
          { error: `No tienes suficientes horas personales disponibles. Disponibles: ${formatAvailableTime(employee.personalHours)}` },
          { status: 400 }
        );
      }
    }

    if (type === LeaveRequestType.REMOTE) {
      const hoursRequired = shift ? calculateHoursToDeduct(shift) : 8; // Default to full day
      if (employee.remoteHours < hoursRequired) {
        return NextResponse.json(
          { error: `No tienes suficientes horas remotas disponibles. Disponibles: ${formatAvailableTime(employee.remoteHours)}` },
          { status: 400 }
        );
      }
    }

    if (type === LeaveRequestType.HOURS && employee.availableHours < hours) {
      return NextResponse.json(
        { error: `No tienes suficientes horas disponibles. Disponibles: ${employee.availableHours}` },
        { status: 400 }
      );
    }

    // LICENSE validation - no limits, just informational tracking
    // No validation needed for LICENSE type as it doesn't consume any pool

    const leaveRequest = await prisma.leave_requests.create({
      data: {
        id: crypto.randomUUID(),
        employeeId: employee.id,
        type: toDbType(type) as any,
        startDate: new Date(startDate + 'T12:00:00.000-03:00'), // Mediodía Argentina para evitar problemas de zona horaria
        endDate: endDate ? new Date(endDate + 'T12:00:00.000-03:00') : new Date(startDate + 'T12:00:00.000-03:00'), // Use startDate as endDate if not provided
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

        // Enviar correo y esperar a completar en runtime serverless
        try {
          const res = await sendNewRequestNotification(adminEmails, emailData);
          console.log('SMTP: admin notification result', res);
        } catch (err) {
          console.error('Error enviando notificación por correo:', err);
        }
      }
    } catch (emailError) {
      console.error('Error preparando notificación por correo:', emailError);
      // No fallar la creación de la solicitud por errores de correo
    }

    // Format response to match frontend expectations (employee instead of employees)
    const formattedLeaveRequest = {
      ...leaveRequest,
      type: fromDbType((leaveRequest as any).type),
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

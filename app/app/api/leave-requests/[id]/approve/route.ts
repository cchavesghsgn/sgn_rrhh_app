
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { sendRequestStatusNotification, RequestStatusEmailData } from '../../../../../lib/email';
import { createCalendarEvent } from '../../../../../lib/calendar';
import { LEAVE_REQUEST_TYPE_LABELS, LeaveRequestType } from '../../../../../lib/types';
import { calculateHoursToDeduct } from '../../../../../lib/time-utils';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

// Bridge enum mismatch between DB (TitleCase) and app (UPPERCASE)
const fromDbType = (t: string) => {
  switch (t) {
    case 'License': return 'LICENSE';
    case 'Personal': return 'PERSONAL';
    case 'Remote': return 'REMOTE';
    case 'Hours': return 'HOURS';
    default: return t;
  }
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Sin permisos' }, { status: 403 });
    }

    const { adminNotes } = await request.json();

    // Get the leave request
    const leaveRequest = await prisma.leave_requests.findUnique({
      where: { id: params.id },
      include: { employees: true }
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 400 });
    }

    // Calculate days/hours to deduct based on request type and shift
    const start = new Date(leaveRequest.startDate);
    const end = new Date(leaveRequest.endDate);
    let daysToDeduct = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    let hoursToDeduct = 0;
    const normalizedType = fromDbType(leaveRequest.type as unknown as string) as LeaveRequestType;
    
    // For LICENSE (vacation days), keep old logic with days
    if (normalizedType === LeaveRequestType.LICENSE) {
      if (leaveRequest.isHalfDay && daysToDeduct === 1) {
        daysToDeduct = 0.5;
      }
    }
    
    // For PERSONAL/REMOTE, calculate hours based on shift
    if (normalizedType === LeaveRequestType.PERSONAL || normalizedType === LeaveRequestType.REMOTE) {
      if (leaveRequest.shift) {
        hoursToDeduct = calculateHoursToDeduct(leaveRequest.shift);
      } else {
        // Fallback: if no shift specified, assume full day
        hoursToDeduct = 8;
      }
    }
    
    // For HOURS type, use the hours specified in the request
    if (normalizedType === LeaveRequestType.HOURS) {
      hoursToDeduct = leaveRequest.hours || 0;
    }

    // Update request status and employee available days/hours
    const result = await prisma.$transaction(async (prisma: any) => {
      // Update leave request
      const updatedRequest = await prisma.leave_requests.update({
        where: { id: params.id },
        data: {
          status: 'APPROVED',
          adminNotes: adminNotes || null
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

      // Update employee available days/hours
      const updateData: any = {};
      
      switch (normalizedType) {
        case LeaveRequestType.LICENSE:
          // LICENSE does NOT deduct from any counter - only tracks taken days
          // No updateData needed - just approve without deducting
          break;
        case LeaveRequestType.VACATION:
          // VACATION deducts from vacation days
          updateData.vacationDays = leaveRequest.employees.vacationDays - daysToDeduct;
          break;
        case LeaveRequestType.PERSONAL:
          // PERSONAL deducts from personalHours
          updateData.personalHours = leaveRequest.employees.personalHours - hoursToDeduct;
          break;
        case LeaveRequestType.REMOTE:
          // REMOTE deducts from remoteHours
          updateData.remoteHours = leaveRequest.employees.remoteHours - hoursToDeduct;
          break;
        case LeaveRequestType.HOURS:
          // HOURS deducts from availableHours
          updateData.availableHours = leaveRequest.employees.availableHours - hoursToDeduct;
          break;
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.employees.update({
          where: { id: leaveRequest.employeeId },
          data: updateData
        });
      }

      return updatedRequest;
    });

    // Enviar notificación por correo al empleado
    try {
      // Formatear la fecha para mostrar
      let displayDate = new Date(result.startDate).toLocaleDateString('es-ES');
      if (result.endDate && result.endDate.getTime() !== result.startDate.getTime()) {
        displayDate += ` - ${new Date(result.endDate).toLocaleDateString('es-ES')}`;
      }

      // Si es solicitud de horas, agregar información del horario
      const resultType = fromDbType(result.type as unknown as string);
      if (resultType === 'HOURS' && result.startTime && result.endTime) {
        displayDate += ` (${result.startTime} - ${result.endTime})`;
      }

      // Si tiene turno, agregarlo
      if (result.shift) {
        const shiftLabels = {
          'MORNING': 'Mañana',
          'AFTERNOON': 'Tarde', 
          'FULL_DAY': 'Todo el día'
        };
        displayDate += ` - ${shiftLabels[result.shift as keyof typeof shiftLabels] || result.shift}`;
      }

      const emailData: RequestStatusEmailData = {
        employeeName: result.employees.User.name || 'Usuario',
        requestType: LEAVE_REQUEST_TYPE_LABELS[resultType as keyof typeof LEAVE_REQUEST_TYPE_LABELS] || resultType,
        requestDate: displayDate,
        status: 'approved',
        adminComment: adminNotes || undefined
      };

      // Enviar correo de forma asíncrona para no bloquear la respuesta
      sendRequestStatusNotification(result.employees.User.email, emailData).catch(error => {
        console.error('Error enviando notificación por correo:', error);
      });
    } catch (emailError) {
      console.error('Error preparando notificación por correo:', emailError);
      // No fallar la aprobación por errores de correo
    }

    // Crear evento en Google Calendar (esperar a que termine en runtime serverless)
    try {
      const calendarResult = await createCalendarEvent(result as any);
      if (calendarResult.success) {
        console.log('✅ Evento creado exitosamente en Google Calendar:', calendarResult.eventId);
      } else {
        console.error('❌ Error creando evento en Google Calendar:', calendarResult.error);
      }
    } catch (calendarError) {
      console.error('❌ Error preparando/creando evento de calendario:', calendarError);
      // No fallar la aprobación por errores de calendario
    }

    // Normalize type in API response for consistency
    return NextResponse.json({ ...result, type: fromDbType(result.type as unknown as string) });
  } catch (error) {
    console.error('Approve leave request error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

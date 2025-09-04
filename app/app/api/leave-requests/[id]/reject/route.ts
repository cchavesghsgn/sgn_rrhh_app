
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../../../lib/auth';
import { PrismaClient } from '@prisma/client';
import { sendRequestStatusNotification, RequestStatusEmailData } from '../../../../../lib/email';
import { LEAVE_REQUEST_TYPE_LABELS } from '../../../../../lib/types';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

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

    const leaveRequest = await prisma.leave_requests.findUnique({
      where: { id: params.id }
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 400 });
    }

    const updatedRequest = await prisma.leave_requests.update({
      where: { id: params.id },
      data: {
        status: 'REJECTED',
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

    // Enviar notificación por correo al empleado
    try {
      // Formatear la fecha para mostrar
      let displayDate = new Date(updatedRequest.startDate).toLocaleDateString('es-ES');
      if (updatedRequest.endDate && updatedRequest.endDate.getTime() !== updatedRequest.startDate.getTime()) {
        displayDate += ` - ${new Date(updatedRequest.endDate).toLocaleDateString('es-ES')}`;
      }

      // Si es solicitud de horas, agregar información del horario
      const resultType = fromDbType(updatedRequest.type as unknown as string);
      if (resultType === 'HOURS' && updatedRequest.startTime && updatedRequest.endTime) {
        displayDate += ` (${updatedRequest.startTime} - ${updatedRequest.endTime})`;
      }

      // Si tiene turno, agregarlo
      if (updatedRequest.shift) {
        const shiftLabels = {
          'MORNING': 'Mañana',
          'AFTERNOON': 'Tarde', 
          'FULL_DAY': 'Todo el día'
        };
        displayDate += ` - ${shiftLabels[updatedRequest.shift as keyof typeof shiftLabels] || updatedRequest.shift}`;
      }

      const emailData: RequestStatusEmailData = {
        employeeName: updatedRequest.employees.User.name || 'Usuario',
        requestType: LEAVE_REQUEST_TYPE_LABELS[resultType as keyof typeof LEAVE_REQUEST_TYPE_LABELS] || resultType,
        requestDate: displayDate,
        status: 'rejected',
        adminComment: adminNotes || undefined
      };

      try {
        const mailRes = await sendRequestStatusNotification(updatedRequest.employees.User.email, emailData);
        console.log('SMTP: status notification result', mailRes);
      } catch (err) {
        console.error('Error enviando notificación por correo:', err);
      }
    } catch (emailError) {
      console.error('Error preparando notificación por correo:', emailError);
      // No fallar el rechazo por errores de correo
    }

    return NextResponse.json({ ...updatedRequest, type: fromDbType(updatedRequest.type as unknown as string) });
  } catch (error) {
    console.error('Reject leave request error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

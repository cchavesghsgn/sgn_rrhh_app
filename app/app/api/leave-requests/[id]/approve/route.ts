
import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../../../lib/auth';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

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
    const leaveRequest = await prisma.leaveRequest.findUnique({
      where: { id: params.id },
      include: { employee: true }
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    if (leaveRequest.status !== 'PENDING') {
      return NextResponse.json({ error: 'La solicitud ya fue procesada' }, { status: 400 });
    }

    // Calculate days/hours to deduct
    const start = new Date(leaveRequest.startDate);
    const end = new Date(leaveRequest.endDate);
    let daysToDeduct = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    if (leaveRequest.isHalfDay && daysToDeduct === 1) {
      daysToDeduct = 0.5;
    }

    // Update request status and employee available days/hours
    const result = await prisma.$transaction(async (prisma) => {
      // Update leave request
      const updatedRequest = await prisma.leaveRequest.update({
        where: { id: params.id },
        data: {
          status: 'APPROVED',
          adminNotes: adminNotes || null
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

      // Update employee available days/hours
      const updateData: any = {};
      
      switch (leaveRequest.type) {
        case 'PERSONAL':
          updateData.personalDays = leaveRequest.employee.personalDays - daysToDeduct;
          break;
        case 'REMOTE':
          updateData.remoteDays = leaveRequest.employee.remoteDays - daysToDeduct;
          break;
        case 'HOURS':
          updateData.availableHours = leaveRequest.employee.availableHours - (leaveRequest.hours || 0);
          break;
        // LICENSE doesn't deduct from available days
      }

      if (Object.keys(updateData).length > 0) {
        await prisma.employee.update({
          where: { id: leaveRequest.employeeId },
          data: updateData
        });
      }

      return updatedRequest;
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Approve leave request error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}


import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../../lib/auth';
import { PrismaClient } from '@prisma/client';

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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const employee = await prisma.employees.findUnique({
      where: { userId: session.user.id },
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
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Transformar los nombres de las relaciones para consistencia con el frontend
    const transformedEmployee = {
      ...employee,
      // Normalize nested leave_requests.type to UPPERCASE for UI
      leave_requests: Array.isArray(employee.leave_requests)
        ? employee.leave_requests.map((lr: any) => ({ ...lr, type: fromDbType(lr.type) }))
        : employee.leave_requests,
      user: employee.User,
      area: employee.Area,
    };

    return NextResponse.json(transformedEmployee);
  } catch (error) {
    console.error('Get employee profile error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

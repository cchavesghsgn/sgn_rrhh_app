import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';
import { getServerAuthSession } from '../../../../lib/auth';

const prisma = new PrismaClient();

export const dynamic = 'force-dynamic';

const csvEscape = (value: unknown): string => {
  if (value === null || value === undefined) return '';

  const str = String(value);
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
};

const formatDate = (date: Date | null | undefined): string => {
  if (!date) return '';

  return new Intl.DateTimeFormat('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'America/Argentina/Buenos_Aires'
  }).format(new Date(date));
};

const toUtcMidnight = (date: Date): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 0, 0, 0, 0));

const calculateInclusiveDays = (startDate: Date, endDate: Date): number => {
  const start = toUtcMidnight(startDate).getTime();
  const end = toUtcMidnight(endDate).getTime();
  return Math.floor((end - start) / (1000 * 60 * 60 * 24)) + 1;
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const monthParam = searchParams.get('month');

    if (!monthParam || !/^\d{4}-(0[1-9]|1[0-2])$/.test(monthParam)) {
      return NextResponse.json(
        { error: 'Parámetro month inválido. Formato esperado: YYYY-MM' },
        { status: 400 }
      );
    }

    const [year, month] = monthParam.split('-').map(Number);
    const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
    const monthEndInclusive = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const monthEndExclusive = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));

    const licenseRequests = await prisma.leave_requests.findMany({
      where: {
        type: 'License',
        startDate: { lt: monthEndExclusive },
        endDate: { gte: monthStart }
      },
      include: {
        employees: {
          include: {
            Area: true,
            User: true
          }
        }
      },
      orderBy: [
        { startDate: 'asc' },
        { createdAt: 'asc' }
      ]
    });

    const headers = [
      'ID Solicitud',
      'Estado',
      'Tipo',
      'Fecha Inicio',
      'Fecha Fin',
      'Fecha Inicio (Mes Solicitado)',
      'Fecha Fin (Mes Solicitado)',
      'Dias en Mes Solicitado',
      'Medio Dia',
      'Horas',
      'Hora Inicio',
      'Hora Fin',
      'Turno',
      'Motivo',
      'Notas Admin',
      'Fecha Creacion',
      'Fecha Actualizacion',
      'ID Empleado',
      'DNI',
      'Nombre',
      'Apellido',
      'Email',
      'Area',
      'Puesto',
      'Telefono'
    ];

    const rows = licenseRequests.map((request) => {
      const employee = request.employees;
      const overlapStart = request.startDate > monthStart ? request.startDate : monthStart;
      const overlapEnd = request.endDate < monthEndInclusive ? request.endDate : monthEndInclusive;
      const overlapDays = calculateInclusiveDays(overlapStart, overlapEnd);
      const daysInRequestedMonth = request.isHalfDay && overlapDays === 1 ? 0.5 : overlapDays;

      return [
        request.id,
        request.status,
        'LICENSE',
        formatDate(request.startDate),
        formatDate(request.endDate),
        formatDate(overlapStart),
        formatDate(overlapEnd),
        daysInRequestedMonth,
        request.isHalfDay ? 'SI' : 'NO',
        request.hours ?? '',
        request.startTime ?? '',
        request.endTime ?? '',
        request.shift ?? '',
        request.reason,
        request.adminNotes ?? '',
        formatDate(request.createdAt),
        formatDate(request.updatedAt),
        employee?.id ?? '',
        employee?.dni ?? '',
        employee?.firstName ?? '',
        employee?.lastName ?? '',
        employee?.User?.email ?? '',
        employee?.Area?.name ?? '',
        employee?.position ?? '',
        employee?.phone ?? ''
      ];
    });

    const csvLines = [
      headers.map(csvEscape).join(','),
      ...rows.map((row) => row.map(csvEscape).join(','))
    ];

    const csvContent = `\uFEFF${csvLines.join('\n')}`;
    const filename = `licencias_${monthParam}.csv`;

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`
      }
    });
  } catch (error) {
    console.error('Export licenses month error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

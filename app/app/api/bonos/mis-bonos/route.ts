import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';

export const dynamic = 'force-dynamic';

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const getDetailValue = (detail: unknown, key: string): unknown =>
  detail && typeof detail === 'object' && !Array.isArray(detail)
    ? (detail as Record<string, unknown>)[key]
    : undefined;

const detailNumber = (detail: unknown, key: string) => {
  const value = getDetailValue(detail, key);
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const detailString = (detail: unknown, key: string) => {
  const value = getDetailValue(detail, key);
  return typeof value === 'string' ? value : '';
};

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const employee = await prisma.employees.findUnique({
      where: { userId: session.user.id },
      select: { id: true }
    });
    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const mesAnio = searchParams.get('mes') || '';
    if (!MES_REGEX.test(mesAnio)) {
      return NextResponse.json({ error: 'Parámetro mes inválido. Formato esperado: YYYY-MM' }, { status: 400 });
    }

    const row = await prisma.bonos_calculo_empleados.findUnique({
      where: {
        empleadoId_mesAnio: {
          empleadoId: employee.id,
          mesAnio
        }
      },
      include: {
        bonos_calculos: {
          select: {
            estado: true,
            generadoAt: true
          }
        }
      }
    });

    if (!row) {
      return NextResponse.json({ mesAnio, bono: null });
    }

    const detail = row.detalleJson;
    return NextResponse.json({
      mesAnio,
      bono: {
        id: row.id,
        estado: row.bonos_calculos.estado,
        generadoAt: row.bonos_calculos.generadoAt,
        sueldoNeto: row.sueldoNeto,
        bonoExperiencia: row.bonoExperiencia,
        bonoCompromiso: row.bonoKpi,
        bonoCargo: detailNumber(detail, 'bonoCargo'),
        bonoHorasExtras: row.bonoDesarrollo,
        bonoCumplimiento: row.bonoCumplimiento,
        totalBonoBase: row.totalBonoBase,
        utilidadPct: row.utilidadPct,
        factorUtilidad: row.factorUtilidad,
        totalBonoFinal: row.totalBonoFinal,
        htmlPath: detailString(detail, 'htmlPath')
      }
    });
  } catch (error) {
    console.error('Mis bonos error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

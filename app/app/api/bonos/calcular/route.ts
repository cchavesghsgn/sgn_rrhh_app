import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { calcularBonos, getBonosCalculo, validateBonosCalculo } from '../../../../lib/bonos-calculo';

export const dynamic = 'force-dynamic';

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const requireAdmin = async () => {
  const session = await getServerAuthSession();
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'No autorizado' }, { status: 401 }) };
  }
  if (session.user.role !== 'ADMIN') {
    return { error: NextResponse.json({ error: 'Acceso denegado' }, { status: 403 }) };
  }
  return { session };
};

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

const serializeCalculo = (calculo: Awaited<ReturnType<typeof getBonosCalculo>>) => {
  if (!calculo) return null;
  return {
    id: calculo.id,
    mesAnio: calculo.mesAnio,
    estado: calculo.estado,
    totalEmpleados: calculo.totalEmpleados,
    totalBonos: calculo.totalBonos,
    generadoAt: calculo.generadoAt,
    empleados: calculo.empleados.map((row) => {
      const detail = row.detalleJson;
      return {
        id: row.id,
        empleadoId: row.empleadoId,
        empleado: `${row.employees.firstName} ${row.employees.lastName}`.replace(/\s+/g, ' ').trim(),
        tipo: detailString(detail, 'tipo') || row.employees.position || '',
        antiguedad: detailNumber(detail, 'antiguedad'),
        sueldoNeto: row.sueldoNeto,
        tapPres: detailNumber(detail, 'tapPres'),
        tapTotal: detailNumber(detail, 'tapTotal'),
        tpeOk: detailNumber(detail, 'tpeOk'),
        tpeTotal: detailNumber(detail, 'tapTotal'),
        ieaOk: detailNumber(detail, 'ieaOk'),
        ieaTotal: detailNumber(detail, 'tapTotal'),
        tardanzas: detailNumber(detail, 'tardanzas'),
        sinMarca: detailNumber(detail, 'sinMarca'),
        kpiPct: row.kpiPct,
        bonoExperiencia: row.bonoExperiencia,
        bonoKpi: row.bonoKpi,
        bonoDesarrollo: row.bonoDesarrollo,
        bonoCumplimiento: row.bonoCumplimiento,
        totalBono: row.totalBono,
        horasExtras: row.horasExtras
      };
    })
  };
};

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;

    const { searchParams } = new URL(request.url);
    const mesAnio = searchParams.get('mes') || '';
    if (!MES_REGEX.test(mesAnio)) {
      return NextResponse.json({ error: 'Parámetro mes inválido. Formato esperado: YYYY-MM' }, { status: 400 });
    }

    const [validation, calculo] = await Promise.all([
      validateBonosCalculo(prisma, mesAnio),
      getBonosCalculo(prisma, mesAnio)
    ]);

    return NextResponse.json({ validation, calculo: serializeCalculo(calculo) });
  } catch (error) {
    console.error('Bonos calcular GET error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAdmin();
    if (auth.error) return auth.error;
    const session = auth.session;

    const body = await request.json().catch(() => ({}));
    const mesAnio = String(body.mes_anio || body.mesAnio || '');
    const force = Boolean(body.force);
    if (!MES_REGEX.test(mesAnio)) {
      return NextResponse.json({ error: 'mes_anio inválido. Formato esperado: YYYY-MM' }, { status: 400 });
    }

    const result = await calcularBonos(prisma, mesAnio, session.user.id, force);
    const calculo = await getBonosCalculo(prisma, mesAnio);
    return NextResponse.json({ result, calculo: serializeCalculo(calculo) });
  } catch (error) {
    console.error('Bonos calcular POST error:', error);
    const status = error instanceof Error && 'status' in error ? Number((error as Error & { status?: number }).status) : 500;
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status });
  }
}

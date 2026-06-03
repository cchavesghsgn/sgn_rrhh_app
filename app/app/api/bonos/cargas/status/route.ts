import { NextRequest, NextResponse } from 'next/server';
import { BonosArchivoTipo } from '@prisma/client';
import { getServerAuthSession } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const getFeriadosUploadMesAnio = (mesAnio: string) => `${mesAnio.slice(0, 4)}-01`;
const isPrismaMissingTableError = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error as { code?: string }).code === 'P2021';

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
    const mesAnio = searchParams.get('mes') || '';
    if (!MES_REGEX.test(mesAnio)) {
      return NextResponse.json(
        { error: 'Parámetro mes inválido. Formato esperado: YYYY-MM' },
        { status: 400 }
      );
    }

    const uploads = await prisma.bonos_uploads.findMany({
      where: {
        OR: [
          { mesAnio, tipoArchivo: { not: BonosArchivoTipo.FERIADOS } },
          { mesAnio: getFeriadosUploadMesAnio(mesAnio), tipoArchivo: BonosArchivoTipo.FERIADOS }
        ]
      },
      include: { User: true }
    });

    let parametro = null;
    try {
      parametro = await prisma.bonos_parametros_mensuales.findUnique({
        where: { mesAnio },
        include: { User: true }
      });
    } catch (error) {
      if (!isPrismaMissingTableError(error)) {
        throw error;
      }
      console.warn('Bonos profitability table missing; returning upload status without utilidad.');
    }

    const byTipo = Object.fromEntries(
      uploads.map((u) => [
        u.tipoArchivo,
        {
          loaded: true,
          fileName: u.fileName,
          rows: u.recordsCount,
          loadedAt: u.loadedAt,
          loadedBy: u.User.email
        }
      ])
    );

    return NextResponse.json({
      mesAnio,
      horarios: byTipo.HORARIOS || { loaded: false },
      ticketsHoras: byTipo.TICKETS_HORAS || { loaded: false },
      feriados: byTipo.FERIADOS || { loaded: false },
      recibos: byTipo.RECIBOS_PDF || { loaded: false },
      utilidad: parametro
        ? {
            loaded: true,
            utilidadPct: parametro.utilidadPct,
            updatedAt: parametro.updatedAt,
            updatedBy: parametro.User.email
          }
        : { loaded: false }
    });
  } catch (error) {
    console.error('Bonos status error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

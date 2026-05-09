import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';

export const dynamic = 'force-dynamic';

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

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
      where: { mesAnio },
      include: { User: true }
    });

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
      ticketsHoras: byTipo.TICKETS_HORAS || { loaded: false }
    });
  } catch (error) {
    console.error('Bonos status error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

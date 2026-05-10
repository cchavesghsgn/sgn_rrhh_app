import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { buildKey, getSignedGetUrl } from '../../../../lib/s3';

export const dynamic = 'force-dynamic';

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

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
    const mesAnio = searchParams.get('mes_anio');
    const includeDownload = searchParams.get('download') === '1';

    if (mesAnio && !MES_REGEX.test(mesAnio)) {
      return NextResponse.json({ error: 'mes_anio inválido. Formato esperado: YYYY-MM' }, { status: 400 });
    }

    const rows = await prisma.bonos_recibos_sueldo.findMany({
      where: {
        empleadoId: employee.id,
        ...(mesAnio ? { mesAnio } : {})
      },
      orderBy: { mesAnio: 'desc' }
    });

    const payload = await Promise.all(
      rows.map(async (r) => {
        let downloadUrl: string | undefined;
        if (includeDownload) {
          const relative = r.filePath.replace(/^\/api\/files\//, '');
          const key = buildKey(relative);
          downloadUrl = await getSignedGetUrl(key, 'application/pdf', r.fileName, 300);
        }
        return {
          id: r.id,
          mesAnio: r.mesAnio,
          fileName: r.fileName,
          originalName: r.originalName,
          pageCount: r.pageCount,
          createdAt: r.createdAt,
          downloadUrl
        };
      })
    );

    return NextResponse.json({ recibos: payload });
  } catch (error) {
    console.error('Mis recibos error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { BonosArchivoTipo } from '@prisma/client';
import { getServerAuthSession } from '../../../../../lib/auth';
import { prisma } from '../../../../../lib/prisma';
import {
  fetchTicketsResumenPayload,
  parseTicketsResumenApi,
  ticketsResumenHash
} from '../../../../../lib/bonos-tickets-api';

export const dynamic = 'force-dynamic';

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const mesAnio = String(body.mes_anio || body.mesAnio || '');
    if (!MES_REGEX.test(mesAnio)) {
      return NextResponse.json({ error: 'mes_anio inválido. Formato esperado: YYYY-MM' }, { status: 400 });
    }

    const payload = await fetchTicketsResumenPayload(mesAnio);
    const rows = parseTicketsResumenApi(payload, mesAnio);
    const fileName = `api-resumen-tickets-${mesAnio}.json`;
    const fileHash = ticketsResumenHash(payload);

    await prisma.$transaction(async (tx) => {
      const upload = await tx.bonos_uploads.upsert({
        where: {
          mesAnio_tipoArchivo: {
            mesAnio,
            tipoArchivo: BonosArchivoTipo.TICKETS_HORAS
          }
        },
        create: {
          id: randomUUID(),
          mesAnio,
          tipoArchivo: BonosArchivoTipo.TICKETS_HORAS,
          fileName,
          fileHash,
          recordsCount: rows.length,
          loadedBy: session.user.id,
          updatedAt: new Date()
        },
        update: {
          fileName,
          fileHash,
          recordsCount: rows.length,
          loadedBy: session.user.id,
          loadedAt: new Date(),
          updatedAt: new Date()
        }
      });

      await tx.bonos_tickets_horas.deleteMany({ where: { uploadId: upload.id } });
      if (rows.length > 0) {
        await tx.bonos_tickets_horas.createMany({
          data: rows.map((r) => ({ ...r, uploadId: upload.id }))
        });
      }
    });

    return NextResponse.json({ mesAnio, ticketsHoras: { replaced: true, fileName, rows: rows.length } });
  } catch (error) {
    console.error('Tickets API sync error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

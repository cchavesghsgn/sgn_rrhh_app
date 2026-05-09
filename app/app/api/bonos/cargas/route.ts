import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { BonosArchivoTipo } from '@prisma/client';
import { getServerAuthSession } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import {
  computeFileHash,
  parseHorariosWorkbook,
  parseTicketsWorkbook
} from '../../../../lib/bonos-upload';

export const dynamic = 'force-dynamic';

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const validXlsx = (fileName: string) => fileName.toLowerCase().endsWith('.xlsx');

async function replaceHorarios(
  mesAnio: string,
  fileName: string,
  fileHash: string,
  loadedBy: string,
  bytes: ArrayBuffer
) {
  const rows = parseHorariosWorkbook(bytes, mesAnio);

  await prisma.$transaction(async (tx) => {
    const upload = await tx.bonos_uploads.upsert({
      where: {
        mesAnio_tipoArchivo: {
          mesAnio,
          tipoArchivo: BonosArchivoTipo.HORARIOS
        }
      },
      create: {
        id: randomUUID(),
        mesAnio,
        tipoArchivo: BonosArchivoTipo.HORARIOS,
        fileName,
        fileHash,
        recordsCount: rows.length,
        loadedBy,
        updatedAt: new Date()
      },
      update: {
        fileName,
        fileHash,
        recordsCount: rows.length,
        loadedBy,
        loadedAt: new Date(),
        updatedAt: new Date()
      }
    });

    await tx.bonos_horarios.deleteMany({ where: { uploadId: upload.id } });
    if (rows.length > 0) {
      await tx.bonos_horarios.createMany({
        data: rows.map((r) => ({ ...r, uploadId: upload.id }))
      });
    }
  });

  return rows.length;
}

async function replaceTickets(
  mesAnio: string,
  fileName: string,
  fileHash: string,
  loadedBy: string,
  bytes: ArrayBuffer
) {
  const rows = parseTicketsWorkbook(bytes, mesAnio);

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
        loadedBy,
        updatedAt: new Date()
      },
      update: {
        fileName,
        fileHash,
        recordsCount: rows.length,
        loadedBy,
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

  return rows.length;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Acceso denegado' }, { status: 403 });
    }

    const formData = await request.formData();
    const mesAnio = String(formData.get('mes_anio') || '');
    if (!MES_REGEX.test(mesAnio)) {
      return NextResponse.json(
        { error: 'mes_anio inválido. Formato esperado: YYYY-MM' },
        { status: 400 }
      );
    }

    const horariosFile = formData.get('horarios_file');
    const ticketsFile = formData.get('tickets_file');

    if (
      (!horariosFile || typeof horariosFile === 'string') &&
      (!ticketsFile || typeof ticketsFile === 'string')
    ) {
      return NextResponse.json(
        { error: 'Debes subir al menos un archivo: horarios_file o tickets_file.' },
        { status: 400 }
      );
    }

    const response: Record<string, unknown> = { mesAnio };

    if (horariosFile && typeof horariosFile !== 'string') {
      if (!validXlsx(horariosFile.name)) {
        return NextResponse.json({ error: 'Horarios debe ser .xlsx' }, { status: 400 });
      }
      const bytes = await horariosFile.arrayBuffer();
      const rows = await replaceHorarios(
        mesAnio,
        horariosFile.name,
        computeFileHash(bytes),
        session.user.id,
        bytes
      );
      response.horarios = { replaced: true, fileName: horariosFile.name, rows };
    }

    if (ticketsFile && typeof ticketsFile !== 'string') {
      if (!validXlsx(ticketsFile.name)) {
        return NextResponse.json({ error: 'Tickets-Horas debe ser .xlsx' }, { status: 400 });
      }
      const bytes = await ticketsFile.arrayBuffer();
      const rows = await replaceTickets(
        mesAnio,
        ticketsFile.name,
        computeFileHash(bytes),
        session.user.id,
        bytes
      );
      response.ticketsHoras = { replaced: true, fileName: ticketsFile.name, rows };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Bonos upload error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

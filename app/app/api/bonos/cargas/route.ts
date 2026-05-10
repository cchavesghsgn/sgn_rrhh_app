import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { BonosArchivoTipo } from '@prisma/client';
import { getServerAuthSession } from '../../../../lib/auth';
import { prisma } from '../../../../lib/prisma';
import { buildKey, putObject } from '../../../../lib/s3';
import {
  computeFileHash,
  parseFeriadosCsv,
  parseHorariosWorkbook,
  parseTicketsWorkbook
} from '../../../../lib/bonos-upload';
import { splitRecibosByEmpleado } from '../../../../lib/bonos-recibos';

export const dynamic = 'force-dynamic';

const MES_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const validInputFile = (fileName: string) => {
  const lower = fileName.toLowerCase();
  return lower.endsWith('.xlsx') || lower.endsWith('.csv');
};

const getYearFromMesAnio = (mesAnio: string) => Number(mesAnio.slice(0, 4));
const getFeriadosUploadMesAnio = (mesAnio: string) => `${getYearFromMesAnio(mesAnio)}-01`;

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

async function replaceFeriados(
  mesAnio: string,
  fileName: string,
  fileHash: string,
  loadedBy: string,
  bytes: ArrayBuffer
) {
  const rows = parseFeriadosCsv(bytes, mesAnio);
  const feriadosMesAnio = getFeriadosUploadMesAnio(mesAnio);

  await prisma.$transaction(async (tx) => {
    const upload = await tx.bonos_uploads.upsert({
      where: {
        mesAnio_tipoArchivo: {
          mesAnio: feriadosMesAnio,
          tipoArchivo: BonosArchivoTipo.FERIADOS
        }
      },
      create: {
        id: randomUUID(),
        mesAnio: feriadosMesAnio,
        tipoArchivo: BonosArchivoTipo.FERIADOS,
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

    await tx.bonos_feriados.deleteMany({ where: { uploadId: upload.id } });
    if (rows.length > 0) {
      await tx.bonos_feriados.createMany({
        data: rows.map((r) => ({ ...r, uploadId: upload.id }))
      });
    }
  });

  return rows.length;
}

async function replaceRecibos(
  mesAnio: string,
  fileName: string,
  fileHash: string,
  loadedBy: string,
  bytes: ArrayBuffer
) {
  const employees = await prisma.employees.findMany({
    select: { id: true, firstName: true, lastName: true }
  });
  const pdfBuffer = Buffer.from(bytes);
  const split = await splitRecibosByEmpleado(pdfBuffer, fileName, employees, mesAnio);

  const upload = await prisma.bonos_uploads.upsert({
    where: {
      mesAnio_tipoArchivo: {
        mesAnio,
        tipoArchivo: BonosArchivoTipo.RECIBOS_PDF
      }
    },
    create: {
      id: randomUUID(),
      mesAnio,
      tipoArchivo: BonosArchivoTipo.RECIBOS_PDF,
      fileName,
      fileHash,
      recordsCount: split.recibos.length,
      loadedBy,
      updatedAt: new Date()
    },
    update: {
      fileName,
      fileHash,
      recordsCount: split.recibos.length,
      loadedBy,
      loadedAt: new Date(),
      updatedAt: new Date()
    }
  });

  for (const rec of split.recibos) {
    const key = buildKey(`recibos/${mesAnio}/${rec.fileName}`);
    await putObject(key, rec.buffer, 'application/pdf');
  }

  await prisma.$transaction(async (tx) => {
    await tx.bonos_recibos_sueldo.deleteMany({ where: { mesAnio } });
    for (const rec of split.recibos) {
      const filePath = `/api/files/recibos/${mesAnio}/${rec.fileName}`;
      await tx.bonos_recibos_sueldo.upsert({
        where: {
          empleadoId_mesAnio: {
            empleadoId: rec.empleadoId,
            mesAnio
          }
        },
        create: {
          id: randomUUID(),
          uploadId: upload.id,
          empleadoId: rec.empleadoId,
          mesAnio,
          sueldoNeto: rec.sueldoNeto,
          filePath,
          fileName: rec.fileName,
          originalName: fileName,
          pageCount: rec.pageCount,
          checksum: rec.checksum,
          updatedAt: new Date()
        },
        update: {
          uploadId: upload.id,
          sueldoNeto: rec.sueldoNeto,
          filePath,
          fileName: rec.fileName,
          originalName: fileName,
          pageCount: rec.pageCount,
          checksum: rec.checksum,
          updatedAt: new Date()
        }
      });
    }
  });

  return {
    rows: split.recibos.length,
    unmatchedPages: split.unmatchedPages
  };
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
    const feriadosFile = formData.get('feriados_file');
    const recibosFile = formData.get('recibos_file');

    if (
      (!horariosFile || typeof horariosFile === 'string') &&
      (!ticketsFile || typeof ticketsFile === 'string') &&
      (!feriadosFile || typeof feriadosFile === 'string') &&
      (!recibosFile || typeof recibosFile === 'string')
    ) {
      return NextResponse.json(
        { error: 'Debes subir al menos un archivo: horarios_file, tickets_file, feriados_file o recibos_file.' },
        { status: 400 }
      );
    }

    const response: Record<string, unknown> = { mesAnio };

    if (horariosFile && typeof horariosFile !== 'string') {
      if (!validInputFile(horariosFile.name)) {
        return NextResponse.json({ error: 'Horarios debe ser .xlsx o .csv' }, { status: 400 });
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
      if (!validInputFile(ticketsFile.name)) {
        return NextResponse.json({ error: 'Tickets-Horas debe ser .xlsx o .csv' }, { status: 400 });
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

    if (feriadosFile && typeof feriadosFile !== 'string') {
      if (!feriadosFile.name.toLowerCase().endsWith('.csv')) {
        return NextResponse.json({ error: 'Calendario Feriados debe ser .csv' }, { status: 400 });
      }
      const bytes = await feriadosFile.arrayBuffer();
      const rows = await replaceFeriados(
        mesAnio,
        feriadosFile.name,
        computeFileHash(bytes),
        session.user.id,
        bytes
      );
      response.feriados = { replaced: true, fileName: feriadosFile.name, rows };
    }

    if (recibosFile && typeof recibosFile !== 'string') {
      if (!recibosFile.name.toLowerCase().endsWith('.pdf')) {
        return NextResponse.json({ error: 'Recibos debe ser .pdf' }, { status: 400 });
      }
      const bytes = await recibosFile.arrayBuffer();
      const result = await replaceRecibos(
        mesAnio,
        recibosFile.name,
        computeFileHash(bytes),
        session.user.id,
        bytes
      );
      response.recibos = {
        replaced: true,
        fileName: recibosFile.name,
        rows: result.rows,
        unmatchedPages: result.unmatchedPages
      };
    }

    return NextResponse.json(response);
  } catch (error) {
    console.error('Bonos upload error:', error);
    const message = error instanceof Error ? error.message : 'Error interno del servidor';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

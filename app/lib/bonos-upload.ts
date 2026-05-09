import { DayShift } from '@prisma/client';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';

export type BonosArchivoTipo = 'HORARIOS' | 'TICKETS_HORAS';

type HorarioRow = {
  id: string;
  mesAnio: string;
  nombreRelojRaw: string;
  nombreRelojNorm: string;
  fecha: Date;
  turno: DayShift;
  horaEntrada: string | null;
  horaSalida: string | null;
  rowNumber: number;
};

type TicketRow = {
  id: string;
  mesAnio: string;
  nroTicket: string | null;
  semana: string | null;
  responsableRaw: string;
  responsableNormApe: string;
  asunto: string | null;
  tipo: string | null;
  horasExtras: number;
  rowNumber: number;
};

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeTime = (value: unknown): string | null => {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s || s.toLowerCase() === 'none' || s.toLowerCase() === 'nan' || s === '-') return null;
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}`;
};

const toDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(Date.UTC(parsed.y, parsed.m - 1, parsed.d, 0, 0, 0, 0));
  }

  const s = String(value).trim();
  if (!s) return null;

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]) - 1;
    const y = Number(dmy[3]);
    return new Date(Date.UTC(y, m, d, 0, 0, 0, 0));
  }

  const parsed = new Date(s);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0));
};

const toMesAnioParts = (mesAnio: string) => {
  const m = mesAnio.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!m) throw new Error('mes_anio inválido. Formato esperado: YYYY-MM');
  return { year: Number(m[1]), month: Number(m[2]) };
};

export const computeFileHash = (bytes: ArrayBuffer): string =>
  createHash('sha256').update(Buffer.from(bytes)).digest('hex');

export const parseHorariosWorkbook = (bytes: ArrayBuffer, mesAnio: string): HorarioRow[] => {
  const { year, month } = toMesAnioParts(mesAnio);
  const workbook = XLSX.read(Buffer.from(bytes), { type: 'buffer', raw: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo de horarios no contiene hojas.');
  }
  const ws = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });

  const out: HorarioRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const nombre = String(row[1] ?? '').trim();
    if (!nombre) continue;

    const fecha = toDate(row[3]);
    if (!fecha) continue;
    const rowMonth = fecha.getUTCMonth() + 1;
    const rowYear = fecha.getUTCFullYear();
    if (rowMonth !== month || rowYear !== year) continue;

    const horario = String(row[4] ?? '').trim().toLowerCase();
    const turno = horario.startsWith('tard') ? DayShift.AFTERNOON : DayShift.MORNING;
    out.push({
      id: randomUUID(),
      mesAnio,
      nombreRelojRaw: nombre,
      nombreRelojNorm: normalize(nombre),
      fecha,
      turno,
      horaEntrada: normalizeTime(row[7]),
      horaSalida: normalizeTime(row[8]),
      rowNumber: i + 1
    });
  }

  return out;
};

export const parseTicketsWorkbook = (bytes: ArrayBuffer, mesAnio: string): TicketRow[] => {
  toMesAnioParts(mesAnio);
  const workbook = XLSX.read(Buffer.from(bytes), { type: 'buffer', raw: true });
  const firstSheetName = workbook.SheetNames[0];
  if (!firstSheetName) {
    throw new Error('El archivo de tickets no contiene hojas.');
  }
  const ws = workbook.Sheets[firstSheetName];
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true });

  const out: TicketRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const responsableRaw = String(row[2] ?? '').trim();
    if (!responsableRaw) continue;

    const horasRaw = row[10];
    const horas = Number(horasRaw);
    if (!Number.isFinite(horas) || horas <= 0) continue;

    const respParts = responsableRaw.split(/\s+/);
    const apellido = respParts.length > 0 ? respParts[respParts.length - 1] : responsableRaw;

    out.push({
      id: randomUUID(),
      mesAnio,
      nroTicket: String(row[0] ?? '').trim() || null,
      semana: String(row[1] ?? '').trim() || null,
      responsableRaw,
      responsableNormApe: normalize(apellido),
      asunto: String(row[3] ?? '').trim() || null,
      tipo: String(row[6] ?? '').trim() || null,
      horasExtras: horas,
      rowNumber: i + 1
    });
  }

  return out;
};

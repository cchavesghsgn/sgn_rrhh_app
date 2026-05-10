import { DayShift } from '@prisma/client';
import { createHash } from 'crypto';
import { randomUUID } from 'crypto';
import * as XLSX from 'xlsx';

export type BonosArchivoTipo = 'HORARIOS' | 'TICKETS_HORAS' | 'FERIADOS';

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
  semana: string | null;
  responsableRaw: string;
  responsableNormApe: string;
  cumplimientoTickets: number | null;
  cumplimientoTotal: number | null;
  cumplimientoPct: number | null;
  calidadTickets: number | null;
  calidadTotal: number | null;
  calidadPct: number | null;
  horasConTicket: number | null;
  horasSinTicket: number | null;
  horasInternas: number | null;
  horasNoLaborales: number | null;
  horasExtras: number;
  horasTotales: number | null;
  fechaCargaHoras: Date | null;
  rowNumber: number;
};

type FeriadoRow = {
  id: string;
  anio: number;
  fecha: Date;
  conmemoracion: string | null;
  rowNumber: number;
};

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeHeader = (value: unknown): string =>
  normalize(String(value ?? ''))
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const findHeaderIndex = (headers: unknown[], candidates: string[], fallback: number): number => {
  const normalizedCandidates = candidates.map(normalizeHeader);
  const idx = headers.findIndex((header) => normalizedCandidates.includes(normalizeHeader(header)));
  return idx >= 0 ? idx : fallback;
};

const findOptionalHeaderIndex = (headers: unknown[], candidates: string[]): number | null => {
  const normalizedCandidates = candidates.map(normalizeHeader);
  const idx = headers.findIndex((header) => normalizedCandidates.includes(normalizeHeader(header)));
  return idx >= 0 ? idx : null;
};

const findPercentHeaderIndex = (headers: unknown[], label: string, fallback: number): number => {
  const normalizedLabel = normalizeHeader(label);
  const idx = headers.findIndex((header) => {
    const raw = String(header ?? '');
    return raw.includes('%') && normalizeHeader(raw).includes(normalizedLabel);
  });
  return idx >= 0 ? idx : fallback;
};

const parseDecimal = (value: unknown): number => {
  if (typeof value === 'number') return value;
  const raw = String(value ?? '').trim();
  if (!raw) return Number.NaN;

  const cleaned = raw
    .replace(/^="?/, '')
    .replace(/"?$/, '')
    .replace(/\s*\(.*\)\s*$/, '')
    .replace(/\./g, '')
    .replace(',', '.')
    .trim();

  return Number(cleaned);
};

const parseCompletion = (value: unknown): { tickets: number | null; total: number | null } => {
  const raw = String(value ?? '').trim().replace(/^="?/, '').replace(/"?$/, '');
  const m = raw.match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return { tickets: null, total: null };
  return { tickets: Number(m[1]), total: Number(m[2]) };
};

const parsePercent = (value: unknown): number | null => {
  const parsed = parseDecimal(String(value ?? '').replace('%', ''));
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1 ? parsed / 100 : parsed;
};

const parseOptionalDecimal = (value: unknown): number | null => {
  const parsed = parseDecimal(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const getOptionalDecimal = (row: unknown[], idx: number | null): number | null =>
  idx === null ? null : parseOptionalDecimal(row[idx]);

const parseDateTime = (value: unknown): Date | null => {
  const raw = String(value ?? '').trim();
  if (!raw || raw === '-') return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const y = Number(m[3]);
  const h = Number(m[4] ?? 0);
  const mi = Number(m[5] ?? 0);
  return new Date(Date.UTC(y, mo, d, h, mi, 0, 0));
};

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

const parseFeriadoDate = (value: string, defaultYear: number): Date | null => {
  const s = value.trim().toLowerCase();
  if (!s) return null;

  const dmy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (dmy) {
    const d = Number(dmy[1]);
    const m = Number(dmy[2]);
    const yRaw = Number(dmy[3]);
    const y = yRaw < 100 ? 2000 + yRaw : yRaw;
    return new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  }

  const esMonth: Record<string, number> = {
    ene: 1, feb: 2, mar: 3, abr: 4, may: 5, jun: 6,
    jul: 7, ago: 8, sep: 9, oct: 10, nov: 11, dic: 12
  };
  const dMon = s.match(/^(\d{1,2})[-/ ]([a-z]{3})$/);
  if (dMon) {
    const d = Number(dMon[1]);
    const m = esMonth[dMon[2]];
    if (!m) return null;
    return new Date(Date.UTC(defaultYear, m - 1, d, 0, 0, 0, 0));
  }

  return null;
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
  const headers = rows[0] || [];
  const responsableIdx = findHeaderIndex(headers, ['Responsable'], 2);
  const semanaIdx = findHeaderIndex(headers, ['Semana'], 1);
  const cumplimientoIdx = findHeaderIndex(headers, ['Cumplimiento'], 2);
  const cumplimientoPctIdx = findPercentHeaderIndex(headers, 'Cumplimiento', 3);
  const calidadIdx = findOptionalHeaderIndex(headers, ['Calidad']);
  const calidadPctIdx = findPercentHeaderIndex(headers, 'Calidad', -1);
  const horasConTicketIdx = findOptionalHeaderIndex(headers, ['Hs c/TKT', 'Hs con TKT', 'Horas con Ticket']);
  const horasSinTicketIdx = findOptionalHeaderIndex(headers, ['Hs s/TKT', 'Hs sin TKT', 'Horas sin Ticket']);
  const horasInternasIdx = findOptionalHeaderIndex(headers, ['Hs Internas', 'Horas Internas']);
  const horasNoLaboralesIdx = findOptionalHeaderIndex(headers, ['Hs NL', 'Horas NL', 'Horas No Laborales']);
  const horasExtrasIdx = findHeaderIndex(headers, ['Hs Extras', 'Horas Extras'], 10);
  const horasTotalesIdx = findOptionalHeaderIndex(headers, ['Hs Totales', 'Horas Totales']);
  const fechaCargaHorasIdx = findOptionalHeaderIndex(headers, ['Fecha Carga Hs', 'Fecha Carga Horas']);

  const out: TicketRow[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i] || [];
    const responsableRaw = String(row[responsableIdx] ?? '').trim();
    if (!responsableRaw) continue;

    const semana = String(row[semanaIdx] ?? '').trim();
    const cumplimiento = parseCompletion(row[cumplimientoIdx]);
    const calidad = calidadIdx === null ? { tickets: null, total: null } : parseCompletion(row[calidadIdx]);
    const horas = parseDecimal(row[horasExtrasIdx]);
    if (!Number.isFinite(horas) || horas < 0) continue;

    const respParts = responsableRaw.split(/\s+/);
    const apellido = respParts.length > 0 ? respParts[respParts.length - 1] : responsableRaw;

    out.push({
      id: randomUUID(),
      mesAnio,
      semana: semana || null,
      responsableRaw,
      responsableNormApe: normalize(apellido),
      cumplimientoTickets: cumplimiento.tickets,
      cumplimientoTotal: cumplimiento.total,
      cumplimientoPct: parsePercent(row[cumplimientoPctIdx]),
      calidadTickets: calidad.tickets,
      calidadTotal: calidad.total,
      calidadPct: calidadPctIdx >= 0 ? parsePercent(row[calidadPctIdx]) : null,
      horasConTicket: getOptionalDecimal(row, horasConTicketIdx),
      horasSinTicket: getOptionalDecimal(row, horasSinTicketIdx),
      horasInternas: getOptionalDecimal(row, horasInternasIdx),
      horasNoLaborales: getOptionalDecimal(row, horasNoLaboralesIdx),
      horasExtras: horas,
      horasTotales: getOptionalDecimal(row, horasTotalesIdx),
      fechaCargaHoras: fechaCargaHorasIdx === null ? null : parseDateTime(row[fechaCargaHorasIdx]),
      rowNumber: i + 1
    });
  }

  return out;
};

export const parseFeriadosCsv = (bytes: ArrayBuffer, mesAnio: string): FeriadoRow[] => {
  const { year } = toMesAnioParts(mesAnio);
  const text = Buffer.from(bytes).toString('utf-8').replace(/^\uFEFF/, '');
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return [];

  const out: FeriadoRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(';');
    const rawDate = String(cols[0] || '').trim();
    const conmemoracion = String(cols[1] || '').trim() || null;
    if (!rawDate) continue;

    const fecha = parseFeriadoDate(rawDate, year);
    if (!fecha) continue;

    out.push({
      id: randomUUID(),
      anio: fecha.getUTCFullYear(),
      fecha,
      conmemoracion,
      rowNumber: i + 1
    });
  }

  return out;
};

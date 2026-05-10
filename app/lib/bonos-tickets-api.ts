import { createHash, randomUUID } from 'crypto';
import type { TicketRow } from './bonos-upload';

const DEFAULT_TICKETS_API_BASE_URL = 'https://sgntickets.abacusai.app';

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const parseMesAnio = (mesAnio: string) => {
  const m = mesAnio.match(/^(\d{4})-(0[1-9]|1[0-2])$/);
  if (!m) throw new Error('mesAnio inválido. Formato esperado: YYYY-MM');
  return { year: Number(m[1]), month: Number(m[2]) };
};

const parseCompletion = (value: unknown): { tickets: number | null; total: number | null } => {
  const m = String(value ?? '').match(/(\d+)\s*\/\s*(\d+)/);
  if (!m) return { tickets: null, total: null };
  return { tickets: Number(m[1]), total: Number(m[2]) };
};

const parsePercent = (value: unknown): number | null => {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return n > 1 ? n / 100 : n;
};

const parseNumber = (value: unknown, fallback = 0): number => {
  const n = typeof value === 'number' ? value : Number(String(value ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : fallback;
};

const parseOptionalNumber = (value: unknown): number | null => {
  const n = parseNumber(value, Number.NaN);
  return Number.isFinite(n) ? n : null;
};

const parseDateTime = (value: unknown): Date | null => {
  const raw = String(value ?? '').trim();
  if (!raw) return null;
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?$/);
  if (!m) return null;
  return new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] ?? 0), Number(m[5] ?? 0), 0, 0));
};

const apiBaseUrl = () => (process.env.TICKETS_API_BASE_URL || DEFAULT_TICKETS_API_BASE_URL).replace(/\/+$/, '');

const fetchJson = async (path: string, timeoutMs = 30000) => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${apiBaseUrl()}${path}`, {
      cache: 'no-store',
      signal: controller.signal
    });
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`API tickets respondió ${res.status}: ${text.slice(0, 300)}`);
    }
    return JSON.parse(text) as unknown;
  } finally {
    clearTimeout(timeout);
  }
};

const objectRows = (payload: unknown): Record<string, unknown>[] => {
  if (!payload || typeof payload !== 'object') return [];
  const rows = (payload as { filas?: unknown }).filas;
  return Array.isArray(rows) ? rows.filter((r): r is Record<string, unknown> => !!r && typeof r === 'object' && !Array.isArray(r)) : [];
};

export const ticketsResumenHash = (payload: unknown): string =>
  createHash('sha256').update(JSON.stringify(payload)).digest('hex');

export const fetchTicketsResumenPayload = async (mesAnio: string): Promise<unknown> => {
  const { year, month } = parseMesAnio(mesAnio);
  return fetchJson(`/api/export/resumen?mes=${month}&anio=${year}`);
};

export const parseTicketsResumenApi = (payload: unknown, mesAnio: string): TicketRow[] => {
  parseMesAnio(mesAnio);
  return objectRows(payload).map((row, idx) => {
    const responsableRaw = String(row.responsable ?? '').trim();
    const respParts = responsableRaw.split(/\s+/);
    const apellido = respParts.length > 0 ? respParts[respParts.length - 1] : responsableRaw;
    const cumplimiento = parseCompletion(row.cumplimiento);
    const calidad = parseCompletion(row.calidad);

    return {
      id: randomUUID(),
      mesAnio,
      semana: String(row.semana ?? '').trim() || null,
      responsableRaw,
      responsableNormApe: normalize(apellido),
      cumplimientoTickets: cumplimiento.tickets,
      cumplimientoTotal: cumplimiento.total,
      cumplimientoPct: parsePercent(row.cumplimientoPct),
      calidadTickets: calidad.tickets,
      calidadTotal: calidad.total,
      calidadPct: parsePercent(row.calidadPct),
      horasConTicket: parseOptionalNumber(row.hsConTkt),
      horasSinTicket: parseOptionalNumber(row.hsSinTkt),
      horasInternas: parseOptionalNumber(row.hsInternas),
      horasNoLaborales: parseOptionalNumber(row.hsNL),
      horasExtras: parseNumber(row.hsExtras),
      horasTotales: parseOptionalNumber(row.hsTotales),
      fechaCargaHoras: parseDateTime(row.fechaCargaHs),
      rowNumber: idx + 1
    };
  }).filter((row) => row.responsableRaw);
};

export type TicketDetalleApiRow = {
  nroTkt: number;
  semana: string;
  responsable: string;
  asunto: string;
  tipo: string;
  hsCargadasSem: number;
  hsExtras: number;
};

export const fetchTicketsDetalleApi = async (mesAnio: string): Promise<TicketDetalleApiRow[]> => {
  const { year, month } = parseMesAnio(mesAnio);
  const payload = await fetchJson(`/api/export/tickets-detallado?mes=${month}&anio=${year}`);
  return objectRows(payload).map((row) => ({
    nroTkt: parseNumber(row.nroTkt),
    semana: String(row.semana ?? '').trim(),
    responsable: String(row.responsable ?? '').trim(),
    asunto: String(row.asunto ?? '').trim(),
    tipo: String(row.tipo ?? '').trim(),
    hsCargadasSem: parseNumber(row.hsCargadasSem),
    hsExtras: parseNumber(row.hsExtras)
  })).filter((row) => row.responsable);
};

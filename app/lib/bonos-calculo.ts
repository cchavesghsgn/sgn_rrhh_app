import { randomUUID } from 'crypto';
import { DayShift, LeaveRequestType } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import * as XLSX from 'xlsx';
import { buildKey, putObject } from './s3';
import { fetchTicketsDetalleApi } from './bonos-tickets-api';

const MES_REGEX = /^(\d{4})-(0[1-9]|1[0-2])$/;

type PrismaTx = Omit<
  PrismaClient,
  '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'
>;

type ValidationItem = {
  key: string;
  label: string;
  loaded: boolean;
  rows: number;
  mesAnio?: string;
};

export type BonosValidation = {
  mesAnio: string;
  recibosMesAnio: string;
  canCalculate: boolean;
  missing: string[];
  items: ValidationItem[];
  existing: {
    exists: boolean;
    totalEmpleados?: number;
    totalBonos?: number;
    generadoAt?: Date;
  };
};

type CumplimientoDetalle = {
  semana: string;
  tickets: number;
  min: number;
  pct: number;
  bono: number;
};

type TardanzaDetalle = {
  fecha: string;
  turno: string;
  hora: string;
  minutos: number;
};

type SinMarcaDetalle = {
  fecha: string;
  marca: string;
};

type HorasExtrasDetalle = {
  nroTkt: number;
  semana: string;
  asunto: string;
  tipo: string;
  horasCargadas: number;
  horasExtras: number;
};

type CalculoEmpleadoResult = {
  empleadoId: string;
  empleadoNombre: string;
  sueldoNeto: number;
  expPct: number;
  bonoExperiencia: number;
  kpiPct: number;
  bonoKpi: number;
  horasExtras: number;
  valorHora: number;
  bonoDesarrollo: number;
  bonoCumplimiento: number;
  totalBono: number;
  htmlResumen: string;
  detalleJson: {
    empleado: string;
    tipo: string;
    area?: string | null;
    antiguedad: number;
    sueldoNeto: number;
    expPct: number;
    tapPres: number;
    tapTotal: number;
    tapPct: number;
    tpeOk: number;
    tpePct: number;
    ieaOk: number;
    ieaPct: number;
    tardanzas: number;
    sinMarca: number;
    sinMarcaExtra: number;
    tardanzasEfectivas: number;
    kpiPct: number;
    horasExtras: number;
    valorHora: number;
    cumplimientoDetalle: CumplimientoDetalle[];
    tardanzasDetalle: TardanzaDetalle[];
    sinMarcaDetalle: SinMarcaDetalle[];
    horasExtrasDetalle: HorasExtrasDetalle[];
    ticketsDetalleWarnings: string[];
    licenciasDias: number;
    htmlPath?: string;
  };
};

type ReportLinks = {
  resumenPdfPath: string;
  planillaExcelPath: string;
  htmlEmpleados: Array<{ empleadoId: string; empleado: string; path: string }>;
};

const normalize = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenMatches = (left: string, right: string) => {
  if (left === right) return true;
  if (left.length > 2 && right.length > 2 && left.slice(0, -1) === right.slice(0, -1)) {
    return (left.endsWith('s') && right.endsWith('z')) || (left.endsWith('z') && right.endsWith('s'));
  }
  return false;
};

const previousMesAnio = (mesAnio: string) => {
  const { year, month } = parseMesAnio(mesAnio);
  const prev = new Date(Date.UTC(year, month - 2, 1));
  return `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, '0')}`;
};

const parseMesAnio = (mesAnio: string) => {
  const m = mesAnio.match(MES_REGEX);
  if (!m) throw new Error('mes_anio inválido. Formato esperado: YYYY-MM');
  return { year: Number(m[1]), month: Number(m[2]) };
};

const dateKey = (date: Date) => date.toISOString().slice(0, 10);

const displayDate = (date: Date) =>
  new Intl.DateTimeFormat('es-AR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'UTC' }).format(date);

const monthEnd = (year: number, month: number) => new Date(Date.UTC(year, month, 0));

const eachDate = (start: Date, end: Date) => {
  const out: Date[] = [];
  const cur = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth(), start.getUTCDate()));
  const last = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  while (cur <= last) {
    out.push(new Date(cur));
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return out;
};

const timeToMin = (value: string | null | undefined) => {
  if (!value) return null;
  const m = value.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const pctToBonus = (pct: number) => {
  if (pct >= 0.9) return 0.0333;
  if (pct >= 0.8) return 0.0166;
  return 0;
};

const ieaToBonus = (pct: number) => {
  if (pct >= 0.5) return 0.0333;
  if (pct >= 0.4) return 0.0166;
  return 0;
};

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

const money = (value: number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value);

const pct = (value: number) => `${((value || 0) * 100).toFixed(1)}%`;

const monthLabel = (mesAnio: string) => {
  const { year, month } = parseMesAnio(mesAnio);
  const labels = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  return `${labels[month]} ${year}`;
};

const safeFileName = (value: string) =>
  normalize(value)
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    || 'empleado';

const filePathForKey = (subpath: string) => `/api/files/${subpath}`;

const yearsOfService = (hireDate: Date, at: Date) => {
  let years = at.getUTCFullYear() - hireDate.getUTCFullYear();
  const monthDiff = at.getUTCMonth() - hireDate.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && at.getUTCDate() < hireDate.getUTCDate())) years--;
  return Math.max(0, years);
};

const areaToTipo = (areaName: string | null | undefined) => {
  const area = normalize(areaName || '');
  if (area.includes('desarrollo')) return 'Desarrollo';
  if (area.includes('soporte')) return 'Soporte';
  if (area.includes('administracion')) return 'Administracion';
  if (area.includes('gerencia')) return 'Gerente';
  return areaName || 'Otros';
};

const experienciaPct = (tipo: string, antiguedad: number) => {
  const levels = [1, 3, 6, 10];
  const idx = levels.reduce((acc, level) => acc + (antiguedad >= level ? 1 : 0), 0);
  const dev = [0.1, 0.2, 0.3, 0.4, 0.5];
  const other = [0.05, 0.1, 0.15, 0.2, 0.3];
  return normalize(tipo).includes('desarrollo') ? dev[idx] : other[idx];
};

const getDiasHabiles = (year: number, month: number, feriados: Set<string>) => {
  const dias: Date[] = [];
  const cur = new Date(Date.UTC(year, month - 1, 1));
  while (cur.getUTCMonth() === month - 1) {
    const dow = cur.getUTCDay();
    if (dow >= 1 && dow <= 5 && !feriados.has(dateKey(cur))) {
      dias.push(new Date(cur));
    }
    cur.setUTCDate(cur.getUTCDate() + 1);
  }
  return dias;
};

const getMonthWeeks = (year: number, month: number, feriados: Set<string>) => {
  const labels = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
  const first = new Date(Date.UTC(year, month - 1, 1));
  const last = monthEnd(year, month);
  const ws = new Date(first);
  const day = ws.getUTCDay() || 7;
  ws.setUTCDate(ws.getUTCDate() - (day - 1));

  const weeks: { label: string; start: Date; end: Date; hasFeriado: boolean }[] = [];
  let n = 1;
  while (ws <= last) {
    const start = new Date(ws);
    const end = new Date(ws);
    end.setUTCDate(end.getUTCDate() + 6);
    if (end >= first) {
      const hasFeriado = eachDate(start, end).some((d) => feriados.has(dateKey(d)));
      weeks.push({ label: `${String(n).padStart(2, '0')}-${labels[month]}`, start, end, hasFeriado });
      n++;
    }
    ws.setUTCDate(ws.getUTCDate() + 7);
  }
  return weeks;
};

export async function validateBonosCalculo(prisma: PrismaClient | PrismaTx, mesAnio: string): Promise<BonosValidation> {
  const { year } = parseMesAnio(mesAnio);
  const recibosMesAnio = previousMesAnio(mesAnio);

  const [horarios, tickets, feriados, recibos, existing] = await Promise.all([
    prisma.bonos_horarios.count({ where: { mesAnio } }),
    prisma.bonos_tickets_horas.count({ where: { mesAnio } }),
    prisma.bonos_feriados.count({ where: { anio: year } }),
    prisma.bonos_recibos_sueldo.count({ where: { mesAnio: recibosMesAnio } }),
    prisma.bonos_calculos.findUnique({ where: { mesAnio } })
  ]);

  const items: ValidationItem[] = [
    { key: 'horarios', label: 'Horarios del mes', loaded: horarios > 0, rows: horarios, mesAnio },
    { key: 'tickets', label: 'Tickets-Horas del mes', loaded: tickets > 0, rows: tickets, mesAnio },
    { key: 'feriados', label: 'Calendario Feriados del año', loaded: feriados > 0, rows: feriados, mesAnio: String(year) },
    { key: 'recibos', label: 'Recibos del mes anterior', loaded: recibos > 0, rows: recibos, mesAnio: recibosMesAnio }
  ];

  const missing = items.filter((item) => !item.loaded).map((item) => `${item.label} (${item.mesAnio})`);
  return {
    mesAnio,
    recibosMesAnio,
    canCalculate: missing.length === 0,
    missing,
    items,
    existing: existing
      ? { exists: true, totalEmpleados: existing.totalEmpleados, totalBonos: existing.totalBonos, generadoAt: existing.generadoAt }
      : { exists: false }
  };
}

const buildEmployeeHtml = (data: CalculoEmpleadoResult & { mesAnio: string }) => {
  const detail = data.detalleJson;
  const cumplimientoRows = detail.cumplimientoDetalle
    .map((row) => `
      <tr>
        <td>${escapeHtml(row.semana)}</td>
        <td class="num" style="text-align:right">${row.tickets}</td>
        <td class="num" style="text-align:right">${pct(row.pct)}</td>
        <td class="num" style="text-align:right">${row.min} tkts</td>
        <td class="num" style="text-align:right">${money(row.bono)}${row.bono === 0 && row.tickets < row.min ? ' <span class="warn">min. no alcanzado</span>' : ''}</td>
      </tr>
    `)
    .join('');
  const tardanzasRows = detail.tardanzasDetalle.length > 0
    ? detail.tardanzasDetalle.map((row) => `
      <tr>
        <td>${escapeHtml(row.fecha)}</td>
        <td>${escapeHtml(row.turno)} - ${escapeHtml(row.hora)} (+${row.minutos} min)</td>
      </tr>
    `).join('')
    : '<tr><td colspan="2">Sin tardanzas registradas</td></tr>';
  const sinMarcaRows = detail.sinMarcaDetalle.length > 0
    ? detail.sinMarcaDetalle.map((row) => `
      <tr>
        <td>${escapeHtml(row.fecha)}</td>
        <td>${escapeHtml(row.marca)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="2">Sin marcas faltantes registradas</td></tr>';
  const horasExtrasRows = detail.horasExtrasDetalle.length > 0
    ? detail.horasExtrasDetalle.map((row) => `
      <tr>
        <td class="num" style="text-align:right">${row.nroTkt || '-'}</td>
        <td>${escapeHtml(row.semana)}</td>
        <td>${escapeHtml(row.asunto)}</td>
        <td>${escapeHtml(row.tipo)}</td>
        <td class="num" style="text-align:right">${row.horasCargadas.toFixed(1)}</td>
        <td class="num" style="text-align:right">${row.horasExtras.toFixed(1)}</td>
      </tr>
    `).join('')
    : '<tr><td colspan="6">Sin horas extras registradas en tickets detallados</td></tr>';
  const ticketsWarnings = detail.ticketsDetalleWarnings.length > 0
    ? `<p class="warn">${detail.ticketsDetalleWarnings.map(escapeHtml).join('<br>')}</p>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body{font-family:Calibri,Arial,sans-serif;color:#333;max-width:720px;margin:0 auto;padding:16px;}
    h2{color:#1F4E79;border-bottom:2px solid #1F4E79;padding-bottom:6px;margin-bottom:4px;}
    h3{color:#1F4E79;margin:18px 0 6px;font-size:14px;}
    table{border-collapse:collapse;width:100%;margin-bottom:12px;font-size:13px;}
    th{background:#1F4E79;color:#fff;padding:7px 10px;text-align:left;}
    td{padding:6px 10px;border:1px solid #ddd;}
    .num{text-align:right !important;}
    th.num{text-align:right !important;}
    tr:nth-child(even){background:#f5f9ff;}
    .ok{color:#375623;font-weight:bold;}
    .warn{color:#843C0C;font-weight:bold;}
    .total-row{background:#E2EFDA;font-weight:bold;font-size:14px;}
    .indicator-row{color:#555;font-style:italic;font-size:12px;}
    .ref-table th,.ref-table td{font-size:12px;padding:5px 8px;}
    .footer{font-size:11px;color:#888;margin-top:20px;border-top:1px solid #eee;padding-top:10px;}
  </style>
</head>
<body>
  <h2>Detalle de Bonos - ${escapeHtml(monthLabel(data.mesAnio))}</h2>
  <p>Estimado/a <strong>${escapeHtml(data.empleadoNombre.split(' ')[0])}</strong>, a continuación el detalle de tu liquidación de bonos correspondiente a <strong>${escapeHtml(monthLabel(data.mesAnio))}</strong>.</p>

  <h3>Liquidación de Bonos</h3>
  <table>
    <tr><th>Concepto</th><th>Detalle</th><th class="num" style="text-align:right">Monto</th></tr>
    <tr><td>Bono Experiencia (${pct(data.expPct)})</td><td>Antigüedad ${detail.antiguedad} años - ${escapeHtml(detail.tipo)}</td><td class="num" style="text-align:right">${money(data.bonoExperiencia)}</td></tr>
    <tr><td>Horas Extras</td><td>${data.horasExtras.toFixed(1)} hs x ${money(data.valorHora)}/h</td><td class="num" style="text-align:right">${money(data.bonoDesarrollo)}</td></tr>
    <tr><td>Bono Compromiso (${pct(data.kpiPct)})</td><td>TPE + TAP + IEA</td><td class="num" style="text-align:right">${money(data.bonoKpi)}</td></tr>
    <tr><td>Bono Cumplimiento</td><td>${detail.cumplimientoDetalle.filter((row) => row.bono > 0).length}/${detail.cumplimientoDetalle.length} semanas calificadas</td><td class="num" style="text-align:right">${money(data.bonoCumplimiento)}</td></tr>
    <tr class="total-row"><td colspan="2"><strong>TOTAL BONOS ${escapeHtml(monthLabel(data.mesAnio))}</strong></td><td class="num" style="text-align:right"><strong>${money(data.totalBono)}</strong></td></tr>
  </table>

  <h3>KPIs de Compromiso</h3>
  <table>
    <tr><th>Indicador</th><th class="num" style="text-align:right">Resultado</th><th class="num" style="text-align:right">Porcentaje</th><th class="num" style="text-align:right">Bono</th></tr>
    <tr><td>TPE - Puntualidad Estricta</td><td class="num" style="text-align:right">${detail.tpeOk} / ${detail.tapTotal} días</td><td class="num ${detail.tpePct >= 0.8 ? 'ok' : 'warn'}" style="text-align:right">${pct(detail.tpePct)}</td><td class="num" style="text-align:right">${pct(pctToBonus(detail.tpePct))}</td></tr>
    <tr><td>TAP - Tasa de Asistencia</td><td class="num" style="text-align:right">${detail.tapPres} / ${detail.tapTotal} días</td><td class="num ${detail.tapPct >= 0.8 ? 'ok' : 'warn'}" style="text-align:right">${pct(detail.tapPct)}</td><td class="num" style="text-align:right">${pct(detail.tardanzasEfectivas >= 4 ? 0 : pctToBonus(detail.tapPct))}</td></tr>
    <tr><td>IEA - Esfuerzo Adicional</td><td class="num" style="text-align:right">${detail.ieaOk} / ${detail.tapTotal} días</td><td class="num ${detail.ieaPct >= 0.4 ? 'ok' : 'warn'}" style="text-align:right">${pct(detail.ieaPct)}</td><td class="num" style="text-align:right">${pct(ieaToBonus(detail.ieaPct))}</td></tr>
    <tr class="indicator-row"><td>Tardanzas efectivas</td><td>${detail.tardanzas} reales + ${detail.sinMarcaExtra} por marcas faltantes</td><td colspan="2" class="num" style="text-align:right">${detail.tardanzasEfectivas}</td></tr>
    <tr class="indicator-row"><td>Sin Marcar</td><td colspan="3" class="num" style="text-align:right">${detail.sinMarca} marcas faltantes</td></tr>
  </table>

  <h3>Detalle Bono Cumplimiento</h3>
  <table>
    <tr><th>Semana</th><th class="num" style="text-align:right">Tickets</th><th class="num" style="text-align:right">Cumplimiento</th><th class="num" style="text-align:right">Mínimo</th><th class="num" style="text-align:right">Bono</th></tr>
    ${cumplimientoRows}
  </table>

  <h3>Detalle de Tardanzas</h3>
  <table>
    <tr><th>Día</th><th>Turno / Hora ingreso</th></tr>
    ${tardanzasRows}
  </table>

  <h3>Detalle de Marcas Faltantes</h3>
  <table>
    <tr><th>Día</th><th>Marcas sin registrar</th></tr>
    ${sinMarcaRows}
  </table>

  <h3>Detalle Horas Extras</h3>
  <table>
    <tr>
      <th class="num" style="text-align:right">Ticket</th>
      <th>Semana</th>
      <th>Asunto</th>
      <th>Tipo</th>
      <th class="num" style="text-align:right">Hs cargadas</th>
      <th class="num" style="text-align:right">Hs extras</th>
    </tr>
    ${horasExtrasRows}
  </table>
  ${ticketsWarnings}

  <h3>Tabla de Referencia - Bono Experiencia</h3>
  <table class="ref-table">
    <tr><th>Tipo</th><th>&lt;1 año</th><th>1-3 años</th><th>3-6 años</th><th>6-10 años</th><th>&gt;=10 años</th></tr>
    <tr><td>Desarrollo</td><td class="num" style="text-align:right">10%</td><td class="num" style="text-align:right">20%</td><td class="num" style="text-align:right">30%</td><td class="num" style="text-align:right">40%</td><td class="num" style="text-align:right">50%</td></tr>
    <tr><td>Soporte/Admin/Gerente</td><td class="num" style="text-align:right">5%</td><td class="num" style="text-align:right">10%</td><td class="num" style="text-align:right">15%</td><td class="num" style="text-align:right">20%</td><td class="num" style="text-align:right">30%</td></tr>
  </table>

  <h3>Tabla de Referencia - Bono Compromiso</h3>
  <table class="ref-table">
    <tr><th>KPI</th><th>Mayor o igual 90%</th><th>Mayor o igual 80%</th><th>Menor 80%</th></tr>
    <tr><td>TPE / TAP</td><td class="num" style="text-align:right">3.33%</td><td class="num" style="text-align:right">1.66%</td><td class="num" style="text-align:right">0%</td></tr>
    <tr><td>IEA</td><td class="num" style="text-align:right">3.33% desde 50%</td><td class="num" style="text-align:right">1.66% desde 40%</td><td class="num" style="text-align:right">0%</td></tr>
  </table>

  <h3>Tabla de Referencia - Bono Cumplimiento</h3>
  <table class="ref-table">
    <tr><th>Cumplimiento semanal</th><th>Mínimo tickets</th><th class="num" style="text-align:right">% sobre valor semanal</th></tr>
    <tr><td>Mayor o igual 90%</td><td>4 tkts (3 si hay feriado)</td><td class="num" style="text-align:right">10%</td></tr>
    <tr><td>Mayor o igual 80%</td><td>4 tkts (3 si hay feriado)</td><td class="num" style="text-align:right">5%</td></tr>
    <tr><td>Menor 80%</td><td>-</td><td class="num" style="text-align:right">0%</td></tr>
  </table>
  <p style="font-size:11px;color:#666">Valor semanal = Sueldo Neto dividido por semanas del mes. Semanas sin mínimo de tickets no califican independientemente del porcentaje.</p>

  <h3>Detalle de fórmulas</h3>
  <table class="ref-table">
    <tr><th>Indicador</th><th>Fórmula</th><th>Observaciones</th></tr>
    <tr><td>TPE</td><td>Días puntuales / días hábiles</td><td>Puntual = entrada mañana menor o igual 08:00 y tarde menor o igual 14:00.</td></tr>
    <tr><td>TAP</td><td>Días presentes / días hábiles</td><td>Licencias aprobadas no suman ni restan. El denominador no se reduce.</td></tr>
    <tr><td>IEA</td><td>Salidas tarde mayor 17:05 / días hábiles</td><td>Cuenta extensión activa al finalizar la jornada.</td></tr>
    <tr><td>Tardanzas</td><td>Entradas con más de 10 min de tolerancia</td><td>Mañana mayor 08:10. Tarde mayor 14:10.</td></tr>
    <tr><td>Sin Marcar</td><td>Entradas/salidas sin registro</td><td>Se toleran 2 olvidos mensuales; desde el tercero equivalen a tardanza.</td></tr>
    <tr><td>B. Experiencia</td><td>Sueldo Neto x porcentaje por antigüedad</td><td>Según tipo Desarrollo u otros.</td></tr>
    <tr><td>Horas Extras</td><td>Horas extras x (Sueldo Neto / 90)</td><td>90 = horas mensuales de referencia.</td></tr>
    <tr><td>B. Compromiso</td><td>Sueldo Neto x (bTPE + bTAP + bIEA)</td><td>Máximo 9.99%.</td></tr>
    <tr><td>B. Cumplimiento</td><td>(Sueldo Neto / semanas) x porcentaje semanal</td><td>Mínimo 4 tickets, o 3 si la semana tiene feriado.</td></tr>
  </table>

  <h3>Reglamento de Asistencia</h3>
  <div style="font-size:12px;color:#444;line-height:1.6;">
    <p><strong>Registro de asistencia</strong><br>Se utiliza sistema de reconocimiento dactilar para marcar entrada y salida. Se permiten hasta 2 olvidos de registros; a partir del tercero será computado como tardanza.</p>
    <p><strong>Tardanzas</strong><br>Se considera tardanza al ingreso posterior a las 08:10 hs y 14:10 hs. Se permiten hasta 3 tardanzas por mes; desde la cuarta se pierde el componente de presentismo.</p>
  </div>

  <div class="footer">
    Este detalle es informativo. Ante cualquier consulta comunicarse con Administración.<br>
    <em>Soft SRL - Sistema Automático de Gestión de RRHH</em>
  </div>
</body>
</html>`;
};

const drawText = (page: any, text: string, x: number, y: number, size: number, font: any, color = rgb(0, 0, 0)) => {
  page.drawText(String(text ?? '').slice(0, 70), { x, y, size, font, color });
};

const drawTextRight = (page: any, text: string, rightX: number, y: number, size: number, font: any, color = rgb(0, 0, 0)) => {
  const value = String(text ?? '').slice(0, 70);
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, { x: rightX - width, y, size, font, color });
};

const drawSectionTitle = (page: any, title: string, x: number, y: number, font: any) => {
  drawText(page, title, x, y, 13, font, rgb(0.12, 0.31, 0.47));
};

const drawTableHeader = (page: any, y: number, headers: Array<{ label: string; x: number; right?: number }>, font: any) => {
  page.drawRectangle({ x: 40, y: y - 6, width: 762, height: 20, color: rgb(0.12, 0.31, 0.47) });
  headers.forEach((h) => {
    if (h.right) drawTextRight(page, h.label, h.right, y, 9, font, rgb(1, 1, 1));
    else drawText(page, h.label, h.x, y, 9, font, rgb(1, 1, 1));
  });
};

const generateResumenPdf = async (mesAnio: string, results: CalculoEmpleadoResult[], totalBonos: number) => {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const bold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([842, 595]);
  const { height } = page.getSize();
  let y = height - 40;

  page.drawLine({ start: { x: 30, y: height - 20 }, end: { x: 812, y: height - 20 }, thickness: 2, color: rgb(0.12, 0.31, 0.47) });
  drawText(page, `Resumen de Bonos - ${monthLabel(mesAnio)}`, 30, y, 18, bold, rgb(0.12, 0.31, 0.47));
  y -= 28;
  drawText(page, `Total empleados: ${results.length}   Total bonos: ${money(totalBonos)}`, 30, y, 11, font);
  y -= 24;

  const cols = [
    { label: 'Empleado', x: 34, w: 150 },
    { label: 'Tipo', x: 185, w: 75 },
    { label: 'Ant.', x: 265, w: 45 },
    { label: 'Sueldo', x: 315, w: 80, right: 395 },
    { label: 'B. Exp.', x: 405, w: 75, right: 480 },
    { label: 'B. Compr.', x: 490, w: 85, right: 575 },
    { label: 'Hs Extras', x: 585, w: 75, right: 660 },
    { label: 'Cumpl.', x: 670, w: 70, right: 740 },
    { label: 'Total', x: 748, w: 64, right: 812 }
  ];

  page.drawRectangle({ x: 30, y: y - 6, width: 782, height: 22, color: rgb(0.12, 0.31, 0.47) });
  cols.forEach((col) => {
    if ('right' in col) drawTextRight(page, col.label, col.right, y, 9, bold, rgb(1, 1, 1));
    else drawText(page, col.label, col.x, y, 9, bold, rgb(1, 1, 1));
  });
  y -= 18;

  results.forEach((row, idx) => {
    if (idx % 2 === 1) page.drawRectangle({ x: 30, y: y - 5, width: 782, height: 18, color: rgb(0.94, 0.94, 0.94) });
    drawText(page, row.empleadoNombre, cols[0].x, y, 8, font);
    drawText(page, row.detalleJson.tipo, cols[1].x, y, 8, font);
    drawText(page, `${row.detalleJson.antiguedad}a`, cols[2].x, y, 8, font);
    drawTextRight(page, money(row.sueldoNeto), cols[3].right, y, 8, font);
    drawTextRight(page, money(row.bonoExperiencia), cols[4].right, y, 8, font);
    drawTextRight(page, money(row.bonoKpi), cols[5].right, y, 8, font);
    drawTextRight(page, money(row.bonoDesarrollo), cols[6].right, y, 8, font);
    drawTextRight(page, money(row.bonoCumplimiento), cols[7].right, y, 8, font);
    drawTextRight(page, money(row.totalBono), cols[8].right, y, 8, bold);
    y -= 18;
  });

  y -= 4;
  page.drawRectangle({ x: 30, y: y - 5, width: 782, height: 20, color: rgb(0.84, 0.9, 0.95) });
  drawText(page, 'TOTAL', 34, y, 9, bold);
  drawTextRight(page, money(results.reduce((sum, row) => sum + row.bonoExperiencia, 0)), cols[4].right, y, 9, bold);
  drawTextRight(page, money(results.reduce((sum, row) => sum + row.bonoKpi, 0)), cols[5].right, y, 9, bold);
  drawTextRight(page, money(results.reduce((sum, row) => sum + row.bonoDesarrollo, 0)), cols[6].right, y, 9, bold);
  drawTextRight(page, money(results.reduce((sum, row) => sum + row.bonoCumplimiento, 0)), cols[7].right, y, 9, bold);
  drawTextRight(page, money(totalBonos), cols[8].right, y, 9, bold);

  for (const row of results) {
    const detail = row.detalleJson;
    const detailPage = pdfDoc.addPage([842, 595]);
    const pageHeight = detailPage.getSize().height;
    let dy = pageHeight - 45;

    detailPage.drawLine({ start: { x: 40, y: pageHeight - 24 }, end: { x: 802, y: pageHeight - 24 }, thickness: 2, color: rgb(0.12, 0.31, 0.47) });
    drawText(detailPage, `Detalle de Bonos - ${monthLabel(mesAnio)}`, 40, dy, 20, bold, rgb(0.12, 0.31, 0.47));
    dy -= 30;
    drawText(detailPage, `Empleado: ${row.empleadoNombre}`, 40, dy, 12, bold);
    drawText(detailPage, `Tipo: ${detail.tipo}   Antigüedad: ${detail.antiguedad} años`, 280, dy, 11, font);
    dy -= 30;

    drawSectionTitle(detailPage, 'Liquidación de Bonos', 40, dy, bold);
    dy -= 18;
    const liqHeaders = [
      { label: 'Concepto', x: 54 },
      { label: 'Detalle', x: 270 },
      { label: 'Monto', x: 700, right: 785 }
    ];
    drawTableHeader(detailPage, dy, liqHeaders, bold);
    dy -= 18;
    const liqRows = [
      [`Bono Experiencia (${pct(row.expPct)})`, `Antigüedad ${detail.antiguedad} años - ${detail.tipo}`, money(row.bonoExperiencia)],
      ['Horas Extras', `${row.horasExtras.toFixed(1)} hs x ${money(row.valorHora)}/h`, money(row.bonoDesarrollo)],
      [`Bono Compromiso (${pct(row.kpiPct)})`, 'TPE + TAP + IEA', money(row.bonoKpi)],
      ['Bono Cumplimiento', `${detail.cumplimientoDetalle.filter((r) => r.bono > 0).length}/${detail.cumplimientoDetalle.length} semanas calificadas`, money(row.bonoCumplimiento)]
    ];
    liqRows.forEach((r, idx) => {
      if (idx % 2 === 0) detailPage.drawRectangle({ x: 40, y: dy - 5, width: 762, height: 18, color: rgb(0.95, 0.97, 1) });
      drawText(detailPage, r[0], 54, dy, 9, font);
      drawText(detailPage, r[1], 270, dy, 9, font);
      drawTextRight(detailPage, r[2], 785, dy, 9, font);
      dy -= 18;
    });
    detailPage.drawRectangle({ x: 40, y: dy - 5, width: 762, height: 20, color: rgb(0.9, 0.94, 0.98) });
    drawText(detailPage, `TOTAL BONOS ${monthLabel(mesAnio)}`, 54, dy, 10, bold);
    drawTextRight(detailPage, money(row.totalBono), 785, dy, 10, bold);
    dy -= 36;

    drawSectionTitle(detailPage, 'KPIs de Compromiso', 40, dy, bold);
    dy -= 18;
    const kpiHeaders = [
      { label: 'Indicador', x: 54 },
      { label: 'Resultado', x: 340, right: 450 },
      { label: 'Porcentaje', x: 540, right: 635 },
      { label: 'Bono', x: 720, right: 785 }
    ];
    drawTableHeader(detailPage, dy, kpiHeaders, bold);
    dy -= 18;
    const tapBonus = detail.tardanzasEfectivas >= 4 ? 0 : pctToBonus(detail.tapPct);
    const kpiRows = [
      ['TPE - Puntualidad Estricta', `${detail.tpeOk} / ${detail.tapTotal} días`, pct(detail.tpePct), pct(pctToBonus(detail.tpePct))],
      ['TAP - Tasa de Asistencia', `${detail.tapPres} / ${detail.tapTotal} días`, pct(detail.tapPct), pct(tapBonus)],
      ['IEA - Esfuerzo Adicional', `${detail.ieaOk} / ${detail.tapTotal} días`, pct(detail.ieaPct), pct(ieaToBonus(detail.ieaPct))],
      ['Tardanzas efectivas', `${detail.tardanzas} reales + ${detail.sinMarcaExtra} por marcas faltantes`, String(detail.tardanzasEfectivas), ''],
      ['Sin Marcar', `${detail.sinMarca} marcas faltantes`, '', '']
    ];
    kpiRows.forEach((r, idx) => {
      if (idx % 2 === 0) detailPage.drawRectangle({ x: 40, y: dy - 5, width: 762, height: 18, color: rgb(0.95, 0.97, 1) });
      drawText(detailPage, r[0], 54, dy, 9, idx >= 3 ? bold : font);
      drawTextRight(detailPage, r[1], 450, dy, 9, font);
      drawTextRight(detailPage, r[2], 635, dy, 9, font);
      drawTextRight(detailPage, r[3], 785, dy, 9, font);
      dy -= 18;
    });
    dy -= 18;

    drawSectionTitle(detailPage, 'Detalle Bono Cumplimiento', 40, dy, bold);
    dy -= 18;
    const cumpHeaders = [
      { label: 'Semana', x: 54 },
      { label: 'Tickets', x: 250, right: 310 },
      { label: 'Cumplimiento', x: 410, right: 500 },
      { label: 'Mínimo', x: 590, right: 650 },
      { label: 'Bono', x: 720, right: 785 }
    ];
    drawTableHeader(detailPage, dy, cumpHeaders, bold);
    dy -= 18;
    detail.cumplimientoDetalle.forEach((r, idx) => {
      if (idx % 2 === 0) detailPage.drawRectangle({ x: 40, y: dy - 5, width: 762, height: 18, color: rgb(0.95, 0.97, 1) });
      drawText(detailPage, r.semana, 54, dy, 9, font);
      drawTextRight(detailPage, String(r.tickets), 310, dy, 9, font);
      drawTextRight(detailPage, pct(r.pct), 500, dy, 9, font);
      drawTextRight(detailPage, `${r.min} tkts`, 650, dy, 9, font);
      drawTextRight(detailPage, money(r.bono), 785, dy, 9, font);
      dy -= 18;
    });
  }

  return Buffer.from(await pdfDoc.save());
};

const generateContadoraXlsx = (mesAnio: string, results: CalculoEmpleadoResult[]) => {
  const total = results.reduce((sum, row) => sum + row.totalBono, 0);
  const rows = [
    [`PLANILLA BONOS - ${monthLabel(mesAnio).toUpperCase()}`],
    [`Generado: ${new Date().toLocaleString('es-AR')}   |   Para: Contadora`],
    ['Empleado', 'Bono Adicional ($)', 'Presentismo', 'Lic.(Días)', 'Cobra Bono por Recibo', 'Observación'],
    ...results.map((row) => [
      row.empleadoNombre,
      row.totalBono,
      row.detalleJson.tardanzasEfectivas >= 4 ? 'No' : 'Si',
      row.detalleJson.licenciasDias || '-',
      'Si',
      ''
    ]),
    ['TOTAL', total, '', '', '', '']
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 28 }, { wch: 18 }, { wch: 14 }, { wch: 12 }, { wch: 22 }, { wch: 42 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Planilla Contadora');
  return Buffer.from(XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
};

const generateAndUploadReports = async (mesAnio: string, results: CalculoEmpleadoResult[], totalBonos: number): Promise<ReportLinks> => {
  const base = `bonos/${mesAnio}`;
  const resumenSubpath = `${base}/Resumen_Bonos_${mesAnio}.pdf`;
  const planillaSubpath = `${base}/Planilla_Contadora_${mesAnio}.xlsx`;

  const pdfBuffer = await generateResumenPdf(mesAnio, results, totalBonos);
  const xlsxBuffer = generateContadoraXlsx(mesAnio, results);

  await putObject(buildKey(resumenSubpath), pdfBuffer, 'application/pdf');
  await putObject(buildKey(planillaSubpath), xlsxBuffer, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');

  const htmlEmpleados: ReportLinks['htmlEmpleados'] = [];
  for (const row of results) {
    const htmlSubpath = `${base}/empleados/email_${safeFileName(row.empleadoNombre)}.html`;
    await putObject(buildKey(htmlSubpath), row.htmlResumen, 'text/html; charset=utf-8');
    row.detalleJson.htmlPath = filePathForKey(htmlSubpath);
    htmlEmpleados.push({ empleadoId: row.empleadoId, empleado: row.empleadoNombre, path: filePathForKey(htmlSubpath) });
  }

  return {
    resumenPdfPath: filePathForKey(resumenSubpath),
    planillaExcelPath: filePathForKey(planillaSubpath),
    htmlEmpleados
  };
};

export async function calcularBonos(
  prisma: PrismaClient,
  mesAnio: string,
  generadoPor: string,
  force = false
) {
  const validation = await validateBonosCalculo(prisma, mesAnio);
  if (!validation.canCalculate) {
    const error = new Error(`Faltan datos para calcular: ${validation.missing.join(', ')}`);
    (error as Error & { status?: number }).status = 400;
    throw error;
  }
  if (validation.existing.exists && !force) {
    const error = new Error('Ya existe un cálculo para este período.');
    (error as Error & { status?: number }).status = 409;
    throw error;
  }

  const { year, month } = parseMesAnio(mesAnio);
  const recibosMesAnio = validation.recibosMesAnio;
  const periodEnd = monthEnd(year, month);
  const monthStart = new Date(Date.UTC(year, month - 1, 1));

  const [
    employees,
    feriadosRows,
    horariosRows,
    ticketsRows,
    recibosRows,
    licenciasRows
  ] = await Promise.all([
    prisma.employees.findMany({ include: { Area: true }, orderBy: [{ lastName: 'asc' }, { firstName: 'asc' }] }),
    prisma.bonos_feriados.findMany({ where: { anio: year } }),
    prisma.bonos_horarios.findMany({ where: { mesAnio } }),
    prisma.bonos_tickets_horas.findMany({ where: { mesAnio } }),
    prisma.bonos_recibos_sueldo.findMany({ where: { mesAnio: recibosMesAnio } }),
    prisma.leave_requests.findMany({
      where: {
        status: 'APPROVED',
        type: { in: [LeaveRequestType.License, LeaveRequestType.Vacation] },
        startDate: { lte: periodEnd },
        endDate: { gte: monthStart }
      }
    })
  ]);

  const feriados = new Set(feriadosRows.map((f) => dateKey(f.fecha)));
  const diasHabiles = getDiasHabiles(year, month, feriados);
  const weeks = getMonthWeeks(year, month, feriados);
  let ticketsDetalleApiAvailable = true;
  let ticketsDetalleApiError: string | null = null;
  const ticketsDetalleRows = await fetchTicketsDetalleApi(mesAnio).catch((error) => {
    ticketsDetalleApiAvailable = false;
    ticketsDetalleApiError = error instanceof Error ? error.message : 'No se pudo leer la API de tickets detallados.';
    return [];
  });

  const horariosByName = new Map<string, Map<string, { morning?: typeof horariosRows[number]; afternoon?: typeof horariosRows[number] }>>();
  for (const row of horariosRows) {
    const name = normalize(row.nombreRelojRaw);
    const day = dateKey(row.fecha);
    const byDay = horariosByName.get(name) ?? new Map();
    const current = byDay.get(day) ?? {};
    if (row.turno === DayShift.AFTERNOON) current.afternoon = row;
    else current.morning = row;
    byDay.set(day, current);
    horariosByName.set(name, byDay);
  }

  const recibosByEmpleado = new Map(recibosRows.map((r) => [r.empleadoId, r]));
  const findEmployeeForResponsible = (responsableRaw: string) => {
    const normalized = normalize(responsableRaw);
    const parts = normalized.split(/\s+/).filter(Boolean);
    return employees.find((e) => {
      const first = normalize(e.firstName);
      const last = normalize(e.lastName);
      return normalized === normalize(`${e.firstName} ${e.lastName}`) || parts.includes(first) || parts.some((p) => tokenMatches(p, last));
    });
  };
  const ticketByEmpleado = new Map<string, typeof ticketsRows>();
  for (const row of ticketsRows) {
    const emp = findEmployeeForResponsible(row.responsableRaw);
    if (!emp) continue;
    const existing = ticketByEmpleado.get(emp.id) ?? [];
    existing.push(row);
    ticketByEmpleado.set(emp.id, existing);
  }
  const ticketsDetalleByEmpleado = new Map<string, HorasExtrasDetalle[]>();
  for (const row of ticketsDetalleRows) {
    const emp = findEmployeeForResponsible(row.responsable);
    if (!emp) continue;
    const existing = ticketsDetalleByEmpleado.get(emp.id) ?? [];
    existing.push({
      nroTkt: row.nroTkt,
      semana: row.semana,
      asunto: row.asunto,
      tipo: row.tipo,
      horasCargadas: row.hsCargadasSem,
      horasExtras: row.hsExtras
    });
    ticketsDetalleByEmpleado.set(emp.id, existing);
  }

  const licenciasByEmpleado = new Map<string, Set<string>>();
  for (const leave of licenciasRows) {
    const set = licenciasByEmpleado.get(leave.employeeId) ?? new Set<string>();
    const start = leave.startDate < monthStart ? monthStart : leave.startDate;
    const end = leave.endDate > periodEnd ? periodEnd : leave.endDate;
    for (const d of eachDate(start, end)) {
      if (diasHabiles.some((h) => dateKey(h) === dateKey(d))) set.add(dateKey(d));
    }
    licenciasByEmpleado.set(leave.employeeId, set);
  }

  const results: CalculoEmpleadoResult[] = employees
    .filter((emp) => recibosByEmpleado.has(emp.id))
    .map((emp) => {
      const recibo = recibosByEmpleado.get(emp.id)!;
      const sueldo = recibo.sueldoNeto;
      const tipo = areaToTipo(emp.Area?.name);
      const antiguedad = yearsOfService(emp.hireDate, periodEnd);
      const expPct = experienciaPct(tipo, antiguedad);
      const bonoExperiencia = Math.round(sueldo * expPct);

      const licenciaSet = licenciasByEmpleado.get(emp.id) ?? new Set<string>();
      const clock = horariosByName.get(normalize(emp.firstName)) ?? new Map();
      let tapPres = 0;
      let tpeOk = 0;
      let ieaOk = 0;
      let tardanzas = 0;
      let sinMarca = 0;
      const tardanzasDetalle: TardanzaDetalle[] = [];
      const sinMarcaDetalle: SinMarcaDetalle[] = [];

      for (const d of diasHabiles) {
        const key = dateKey(d);
        if (licenciaSet.has(key)) continue;
        tapPres++;
        const marks = clock.get(key) ?? {};
        const mi = marks.morning?.horaEntrada ?? null;
        const mo = marks.morning?.horaSalida ?? null;
        const ai = marks.afternoon?.horaEntrada ?? null;
        const ao = marks.afternoon?.horaSalida ?? null;
        const miM = timeToMin(mi);
        const aiM = timeToMin(ai);
        if (miM !== null && miM > 8 * 60 + 10) {
          tardanzas++;
          tardanzasDetalle.push({ fecha: displayDate(d), turno: 'Mañana', hora: mi, minutos: miM - 8 * 60 });
        }
        if (aiM !== null && aiM > 14 * 60 + 10) {
          tardanzas++;
          tardanzasDetalle.push({ fecha: displayDate(d), turno: 'Tarde', hora: ai, minutos: aiM - 14 * 60 });
        }
        for (const item of [
          { label: 'Mañana entrada', value: mi },
          { label: 'Mañana salida', value: mo },
          { label: 'Tarde entrada', value: ai },
          { label: 'Tarde salida', value: ao }
        ]) {
          if (!item.value) {
            sinMarca++;
            sinMarcaDetalle.push({ fecha: displayDate(d), marca: item.label });
          }
        }
        if (miM !== null && miM <= 8 * 60 && aiM !== null && aiM <= 14 * 60) tpeOk++;
        const aoM = timeToMin(ao);
        if (aoM !== null && aoM > 17 * 60 + 5) ieaOk++;
      }

      const tapTotal = diasHabiles.length || 1;
      const sinMarcaExtra = Math.max(0, sinMarca - 2);
      const tardanzasEfectivas = tardanzas + sinMarcaExtra;
      const tapPct = tapPres / tapTotal;
      const tpePct = tpeOk / tapTotal;
      const ieaPct = ieaOk / tapTotal;
      const tapBonus = tardanzasEfectivas >= 4 ? 0 : pctToBonus(tapPct);
      const kpiPct = pctToBonus(tpePct) + tapBonus + ieaToBonus(ieaPct);
      const bonoKpi = Math.round(sueldo * kpiPct);

      const tickets = ticketByEmpleado.get(emp.id) ?? [];
      const weeklyTickets = tickets.filter((t) => normalize(t.semana || '') !== 'total');
      const horasExtrasResumen = weeklyTickets.reduce((sum, t) => sum + t.horasExtras, 0);
      const horasExtrasDetalleRows = ticketsDetalleByEmpleado.get(emp.id) ?? [];
      const horasExtrasDetalle = horasExtrasDetalleRows.filter((row) => row.horasExtras > 0);
      const horasExtrasDetalleTotal = horasExtrasDetalle.reduce((sum, row) => sum + row.horasExtras, 0);
      const horasExtras = ticketsDetalleApiAvailable ? horasExtrasDetalleTotal : horasExtrasResumen;
      const ticketsDetalleWarnings: string[] = [];
      if (!ticketsDetalleApiAvailable && ticketsDetalleApiError) {
        ticketsDetalleWarnings.push(`No se pudo leer la API de tickets detallados. Se usó el total del resumen: ${ticketsDetalleApiError}`);
      } else if (Math.abs(horasExtrasDetalleTotal - horasExtrasResumen) > 0.01) {
        ticketsDetalleWarnings.push(`Diferencia entre resumen (${horasExtrasResumen.toFixed(1)} hs) y detalle (${horasExtrasDetalleTotal.toFixed(1)} hs). Se usó el detalle.`);
      }
      const valorHora = sueldo > 0 ? sueldo / 90 : 0;
      const bonoDesarrollo = Math.round(valorHora * horasExtras);

      const ticketsBySemana = new Map(weeklyTickets.map((t) => [normalize(t.semana || ''), t]));
      let bonoCumplimiento = 0;
      const cumplimientoDetalle = weeks.map((week) => {
        const row = ticketsBySemana.get(normalize(week.label));
        const ticketsDone = row?.cumplimientoTickets ?? 0;
        const pct = row?.cumplimientoPct ?? 0;
        const min = week.hasFeriado ? 3 : 4;
        const bonoSemana = ticketsDone < min ? 0 : (sueldo / weeks.length) * (pct >= 0.9 ? 0.1 : pct >= 0.8 ? 0.05 : 0);
        bonoCumplimiento += bonoSemana;
        return { semana: week.label, tickets: ticketsDone, min, pct, bono: Math.round(bonoSemana) };
      });
      bonoCumplimiento = Math.round(bonoCumplimiento);

      const totalBono = bonoExperiencia + bonoKpi + bonoDesarrollo + bonoCumplimiento;
      const empleadoNombre = `${emp.firstName} ${emp.lastName}`.replace(/\s+/g, ' ').trim();
      const detail = {
        empleado: empleadoNombre,
        tipo,
        area: emp.Area?.name,
        antiguedad,
        sueldoNeto: sueldo,
        expPct,
        tapPres,
        tapTotal,
        tapPct,
        tpeOk,
        tpePct,
        ieaOk,
        ieaPct,
        tardanzas,
        sinMarca,
        sinMarcaExtra,
        tardanzasEfectivas,
        kpiPct,
        horasExtras,
        valorHora,
        cumplimientoDetalle,
        tardanzasDetalle,
        sinMarcaDetalle,
        horasExtrasDetalle,
        ticketsDetalleWarnings,
        licenciasDias: licenciaSet.size
      };

      const result: CalculoEmpleadoResult = {
        empleadoId: emp.id,
        empleadoNombre,
        sueldoNeto: sueldo,
        expPct,
        bonoExperiencia,
        kpiPct,
        bonoKpi,
        horasExtras,
        valorHora,
        bonoDesarrollo,
        bonoCumplimiento,
        totalBono,
        htmlResumen: '',
        detalleJson: detail
      };
      result.htmlResumen = buildEmployeeHtml({ ...result, mesAnio });
      return result;
    });

  const totalBonos = results.reduce((sum, r) => sum + r.totalBono, 0);
  const calculoId = randomUUID();
  const missingRecibos = employees.filter((e) => !recibosByEmpleado.has(e.id)).map((e) => `${e.firstName} ${e.lastName}`.replace(/\s+/g, ' ').trim());
  const reportLinks = await generateAndUploadReports(mesAnio, results, totalBonos);

  await prisma.$transaction(async (tx) => {
    await tx.bonos_calculos.deleteMany({ where: { mesAnio } });
    await tx.bonos_calculos.create({
      data: {
        id: calculoId,
        mesAnio,
        estado: 'CALCULADO',
        totalEmpleados: results.length,
        totalBonos,
        resumenPdfPath: reportLinks.resumenPdfPath,
        planillaExcelPath: reportLinks.planillaExcelPath,
        generadoPor,
        updatedAt: new Date(),
        detalleJson: {
          recibosMesAnio,
          diasHabiles: diasHabiles.length,
          empleadosSinRecibo: missingRecibos,
          reportes: reportLinks,
          generatedByVersion: 1
        },
        empleados: {
          create: results.map((r) => ({
            id: randomUUID(),
            empleadoId: r.empleadoId,
            mesAnio,
            sueldoNeto: r.sueldoNeto,
            expPct: r.expPct,
            bonoExperiencia: r.bonoExperiencia,
            kpiPct: r.kpiPct,
            bonoKpi: r.bonoKpi,
            horasExtras: r.horasExtras,
            valorHora: r.valorHora,
            bonoDesarrollo: r.bonoDesarrollo,
            bonoCumplimiento: r.bonoCumplimiento,
            totalBono: r.totalBono,
            htmlResumen: r.htmlResumen,
            detalleJson: r.detalleJson
          }))
        }
      }
    });
  });

  return {
    id: calculoId,
    mesAnio,
    recibosMesAnio,
    totalEmpleados: results.length,
    totalBonos,
    reportes: reportLinks,
    empleadosSinRecibo: missingRecibos,
    empleados: results.sort((a, b) => b.totalBono - a.totalBono)
  };
}

export async function getBonosCalculo(prisma: PrismaClient | PrismaTx, mesAnio: string) {
  parseMesAnio(mesAnio);
  return prisma.bonos_calculos.findUnique({
    where: { mesAnio },
    include: {
      empleados: {
        include: { employees: true },
        orderBy: { totalBono: 'desc' }
      }
    }
  });
}

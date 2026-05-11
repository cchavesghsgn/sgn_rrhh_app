import { randomUUID } from 'crypto';
import { DayShift, LeaveRequestType } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';
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

const reportHtmlShell = (title: string, body: string) => `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body{font-family:Calibri,Arial,sans-serif;color:#333;margin:0;padding:24px;background:#fff;}
    .page{max-width:1180px;margin:0 auto 28px;page-break-after:always;}
    .employee-page{max-width:760px;margin:0 auto 28px;page-break-before:always;}
    h1{color:#1F4E79;border-bottom:3px solid #1F4E79;padding-bottom:8px;margin:0 0 16px;font-size:28px;}
    h2{color:#1F4E79;border-bottom:2px solid #1F4E79;padding-bottom:6px;margin-bottom:4px;}
    h3{color:#1F4E79;margin:18px 0 6px;font-size:14px;}
    table{border-collapse:collapse;width:100%;margin-bottom:12px;font-size:13px;}
    th{background:#1F4E79;color:#fff;padding:7px 10px;text-align:left;}
    td{padding:6px 10px;border:1px solid #ddd;}
    tr:nth-child(even){background:#f5f9ff;}
    .num{text-align:right !important;}
    th.num{text-align:right !important;}
    .ok{color:#375623;font-weight:bold;}
    .warn{color:#843C0C;font-weight:bold;}
    .total-row{background:#E2EFDA;font-weight:bold;font-size:14px;}
    .indicator-row{color:#555;font-style:italic;font-size:12px;}
    .ref-table th,.ref-table td{font-size:12px;padding:5px 8px;}
    .meta{font-size:13px;color:#555;margin-bottom:16px;}
    .footer{font-size:11px;color:#888;margin-top:20px;border-top:1px solid #eee;padding-top:10px;}
  </style>
  <title>${escapeHtml(title)}</title>
</head>
<body>
${body}
</body>
</html>`;

const htmlBody = (html: string) => {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1].trim() : html;
};

const generateResumenHtml = (mesAnio: string, results: CalculoEmpleadoResult[], totalBonos: number) => {
  const totals = {
    sueldo: results.reduce((sum, row) => sum + row.sueldoNeto, 0),
    exp: results.reduce((sum, row) => sum + row.bonoExperiencia, 0),
    compromiso: results.reduce((sum, row) => sum + row.bonoKpi, 0),
    horas: results.reduce((sum, row) => sum + row.bonoDesarrollo, 0),
    cumplimiento: results.reduce((sum, row) => sum + row.bonoCumplimiento, 0)
  };
  const resumenRows = results.map((row) => `
    <tr>
      <td>${escapeHtml(row.empleadoNombre)}</td>
      <td>${escapeHtml(row.detalleJson.tipo)}</td>
      <td class="num">${row.detalleJson.antiguedad} años</td>
      <td class="num">${money(row.sueldoNeto)}</td>
      <td class="num">${money(row.bonoExperiencia)}</td>
      <td class="num">${money(row.bonoKpi)}</td>
      <td class="num">${money(row.bonoDesarrollo)}</td>
      <td class="num">${money(row.bonoCumplimiento)}</td>
      <td class="num"><strong>${money(row.totalBono)}</strong></td>
    </tr>
  `).join('');
  const employees = results.map((row) => `<section class="employee-page">${htmlBody(row.htmlResumen)}</section>`).join('\n');
  return reportHtmlShell(
    `Resumen de Bonos - ${monthLabel(mesAnio)}`,
    `<section class="page">
      <h1>Resumen de Bonos - ${escapeHtml(monthLabel(mesAnio))}</h1>
      <p class="meta">Total empleados: ${results.length} · Total bonos: ${money(totalBonos)} · Generado: ${new Date().toLocaleString('es-AR')}</p>
      <table>
        <tr>
          <th>Empleado</th>
          <th>Tipo</th>
          <th class="num">Antigüed.</th>
          <th class="num">Sueldo</th>
          <th class="num">Bono Exp.</th>
          <th class="num">Bono Compr.</th>
          <th class="num">Horas Extras</th>
          <th class="num">Bono Cumpl.</th>
          <th class="num">TOTAL BONO</th>
        </tr>
        ${resumenRows}
        <tr class="total-row">
          <td>TOTAL</td>
          <td></td>
          <td></td>
          <td class="num">${money(totals.sueldo)}</td>
          <td class="num">${money(totals.exp)}</td>
          <td class="num">${money(totals.compromiso)}</td>
          <td class="num">${money(totals.horas)}</td>
          <td class="num">${money(totals.cumplimiento)}</td>
          <td class="num">${money(totalBonos)}</td>
        </tr>
      </table>
    </section>
    ${employees}`
  );
};

const generateContadoraHtml = (mesAnio: string, results: CalculoEmpleadoResult[]) => {
  const totalBonos = results.reduce((sum, row) => sum + row.totalBono, 0);
  const totalLicencias = results.reduce((sum, row) => sum + row.detalleJson.licenciasDias, 0);
  const rows = results.map((row) => `
    <tr>
      <td>${escapeHtml(row.empleadoNombre)}</td>
      <td class="num">${money(row.totalBono)}</td>
      <td>SI</td>
      <td class="num">${row.detalleJson.licenciasDias}</td>
    </tr>
  `).join('');
  return reportHtmlShell(
    `Planilla Contadora - ${monthLabel(mesAnio)}`,
    `<section class="page">
      <h1>Planilla Contadora - ${escapeHtml(monthLabel(mesAnio))}</h1>
      <p class="meta">Generado: ${new Date().toLocaleString('es-AR')}</p>
      <table>
        <tr>
          <th>Empleado</th>
          <th class="num">Bono Adicional</th>
          <th>Presentismo</th>
          <th class="num">Licencias</th>
        </tr>
        ${rows}
        <tr class="total-row">
          <td>TOTAL</td>
          <td class="num">${money(totalBonos)}</td>
          <td></td>
          <td class="num">${totalLicencias}</td>
        </tr>
      </table>
    </section>`
  );
};

const generateAndUploadReports = async (mesAnio: string, results: CalculoEmpleadoResult[], totalBonos: number): Promise<ReportLinks> => {
  const base = `bonos/${mesAnio}`;
  const resumenSubpath = `${base}/Resumen_Bonos_${mesAnio}.html`;
  const planillaSubpath = `${base}/Planilla_Contadora_${mesAnio}.html`;

  const resumenHtml = generateResumenHtml(mesAnio, results, totalBonos);
  const contadoraHtml = generateContadoraHtml(mesAnio, results);

  await putObject(buildKey(resumenSubpath), resumenHtml, 'text/html; charset=utf-8');
  await putObject(buildKey(planillaSubpath), contadoraHtml, 'text/html; charset=utf-8');

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

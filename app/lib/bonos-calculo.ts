import { randomUUID } from 'crypto';
import { DayShift, LeaveRequestType } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

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

const buildEmployeeHtml = (data: {
  empleado: string;
  mesAnio: string;
  sueldoNeto: number;
  bonoExperiencia: number;
  bonoKpi: number;
  bonoDesarrollo: number;
  bonoCumplimiento: number;
  totalBono: number;
  tapPct: number;
  tpePct: number;
  ieaPct: number;
  horasExtras: number;
}) => `
  <section>
    <h1>Bono ${escapeHtml(data.mesAnio)} - ${escapeHtml(data.empleado)}</h1>
    <p><strong>Sueldo neto base:</strong> ${money(data.sueldoNeto)}</p>
    <table>
      <tbody>
        <tr><td>Bono experiencia</td><td>${money(data.bonoExperiencia)}</td></tr>
        <tr><td>Bono compromiso</td><td>${money(data.bonoKpi)}</td></tr>
        <tr><td>Horas extras</td><td>${money(data.bonoDesarrollo)} (${data.horasExtras} hs)</td></tr>
        <tr><td>Bono cumplimiento</td><td>${money(data.bonoCumplimiento)}</td></tr>
        <tr><td><strong>Total bono</strong></td><td><strong>${money(data.totalBono)}</strong></td></tr>
      </tbody>
    </table>
    <p>KPI: TAP ${(data.tapPct * 100).toFixed(1)}% · TPE ${(data.tpePct * 100).toFixed(1)}% · IEA ${(data.ieaPct * 100).toFixed(1)}%</p>
  </section>
`;

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

  const empleadosById = new Map(employees.map((e) => [e.id, e]));
  const recibosByEmpleado = new Map(recibosRows.map((r) => [r.empleadoId, r]));
  const ticketByEmpleado = new Map<string, typeof ticketsRows>();
  for (const row of ticketsRows) {
    const normalized = normalize(row.responsableRaw);
    const parts = normalized.split(/\s+/).filter(Boolean);
    const emp = employees.find((e) => {
      const first = normalize(e.firstName);
      const last = normalize(e.lastName);
      return normalized === normalize(`${e.firstName} ${e.lastName}`) || parts.includes(first) || parts.some((p) => tokenMatches(p, last));
    });
    if (!emp) continue;
    const existing = ticketByEmpleado.get(emp.id) ?? [];
    existing.push(row);
    ticketByEmpleado.set(emp.id, existing);
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

  const results = employees
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
        if (miM !== null && miM > 8 * 60 + 10) tardanzas++;
        if (aiM !== null && aiM > 14 * 60 + 10) tardanzas++;
        for (const v of [mi, mo, ai, ao]) if (!v) sinMarca++;
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
      const horasExtras = weeklyTickets.reduce((sum, t) => sum + t.horasExtras, 0);
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
        licenciasDias: licenciaSet.size
      };

      return {
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
        htmlResumen: buildEmployeeHtml({
          empleado: empleadoNombre,
          mesAnio,
          sueldoNeto: sueldo,
          bonoExperiencia,
          bonoKpi,
          bonoDesarrollo,
          bonoCumplimiento,
          totalBono,
          tapPct,
          tpePct,
          ieaPct,
          horasExtras
        }),
        detalleJson: detail
      };
    });

  const totalBonos = results.reduce((sum, r) => sum + r.totalBono, 0);
  const calculoId = randomUUID();
  const missingRecibos = employees.filter((e) => !recibosByEmpleado.has(e.id)).map((e) => `${e.firstName} ${e.lastName}`.replace(/\s+/g, ' ').trim());

  await prisma.$transaction(async (tx) => {
    await tx.bonos_calculos.deleteMany({ where: { mesAnio } });
    await tx.bonos_calculos.create({
      data: {
        id: calculoId,
        mesAnio,
        estado: 'CALCULADO',
        totalEmpleados: results.length,
        totalBonos,
        generadoPor,
        updatedAt: new Date(),
        detalleJson: {
          recibosMesAnio,
          diasHabiles: diasHabiles.length,
          empleadosSinRecibo: missingRecibos,
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

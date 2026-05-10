import { randomUUID } from 'crypto';
import { PDFDocument } from 'pdf-lib';
import { createHash } from 'crypto';

const pdfParse = require('pdf-parse');

type EmployeeLite = {
  id: string;
  firstName: string;
  lastName: string;
};

type SplitResult = {
  empleadoId: string;
  empleadoNombre: string;
  fileName: string;
  buffer: Buffer;
  checksum: string;
  sueldoNeto: number;
  pageCount: number;
};

const normalize = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const normalizeName = (value: string) =>
  normalize(value)
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenizeName = (value: string) => normalizeName(value).split(/\s+/).filter(Boolean);

const tokenMatches = (left: string, right: string) => {
  if (left === right) return true;
  if (left.length > 2 && right.length > 2 && left.slice(0, -1) === right.slice(0, -1)) {
    return (left.endsWith('s') && right.endsWith('z')) || (left.endsWith('z') && right.endsWith('s'));
  }
  return false;
};

const includesToken = (tokens: string[], expected: string) =>
  tokens.some((token) => tokenMatches(token, expected));

const parseMoney = (value: string): number | null => {
  const raw = value.trim();
  const normalized = raw.includes('.') && raw.includes(',')
    ? raw.replace(/,/g, '')
    : raw.includes('.') && /\.\d{2}$/.test(raw)
      ? raw
      : raw.replace(/\./g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const extractMoneyNear = (lines: string[], startIdx: number, direction: -1 | 1): number | null => {
  for (let offset = 1; offset <= 4; offset++) {
    const line = lines[startIdx + offset * direction];
    if (!line) continue;
    const matches = line.match(/\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+(?:\.\d{2})/g);
    if (!matches) continue;
    const parsed = parseMoney(matches[matches.length - 1]);
    if (parsed !== null) return parsed;
  }
  return null;
};

const extractSueldoNeto = (pageText: string): number => {
  const lines = pageText.split('\n').map((l) => l.trim()).filter(Boolean);
  let totalNeto: number | null = null;
  let bono471 = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/total\s+neto/i.test(line)) {
      const sameLine = line.match(/total\s+neto\s*:?\s*([\d,.]+)/i);
      totalNeto = sameLine ? parseMoney(sameLine[1]) : extractMoneyNear(lines, i, -1);
    }

    if (line === '471' || /bono\s+adicional\s+no\s+rem/i.test(line)) {
      const nearby = extractMoneyNear(lines, i, 1);
      if (nearby !== null) bono471 = nearby;
    }
  }

  if (totalNeto === null) return 0;
  return Math.max(0, Math.round(totalNeto - bono471));
};

const extractEmployeeName = (pageText: string): string | null => {
  const lines = pageText.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    const m = line.match(/^\d+\s+(.+?)\s+\d{2}-\d{8}-\d\b/);
    if (m) return m[1].trim();
  }

  const legajoIdx = lines.findIndex((line) => line.toLowerCase() === 'legajo');
  if (legajoIdx > 0 && lines[legajoIdx - 1]?.includes(',')) {
    return lines[legajoIdx - 1].replace(/\s*,\s*/g, ', ').trim();
  }

  const periodoIdx = lines.findIndex((line) => line.toLowerCase() === 'período' || line.toLowerCase() === 'periodo');
  if (periodoIdx >= 0 && lines[periodoIdx + 1]?.includes(',')) {
    return lines[periodoIdx + 1].replace(/\s*,\s*/g, ', ').trim();
  }

  return null;
};

const findEmployeeByPdfName = (rawName: string, employees: EmployeeLite[]) => {
  const normalizedRaw = normalizeName(rawName);
  const rawParts = tokenizeName(rawName);

  let exact = employees.find((e) => normalizeName(`${e.lastName} ${e.firstName}`) === normalizedRaw);
  if (exact) return exact;

  exact = employees.find((e) => normalizeName(`${e.firstName} ${e.lastName}`) === normalizedRaw);
  if (exact) return exact;

  let partial = employees.find((e) => {
    const lastParts = tokenizeName(e.lastName);
    const firstParts = tokenizeName(e.firstName);
    return (
      lastParts.length > 0 &&
      firstParts.length > 0 &&
      lastParts.every((part) => includesToken(rawParts, part)) &&
      firstParts.every((part) => includesToken(rawParts, part))
    );
  });
  if (partial) return partial;

  partial = employees.find((e) => tokenizeName(e.lastName).every((part) => includesToken(rawParts, part)));
  return partial || null;
};

export async function splitRecibosByEmpleado(
  pdfBuffer: Buffer,
  originalFileName: string,
  employees: EmployeeLite[],
  mesAnio: string
): Promise<{
  recibos: SplitResult[];
  unmatchedPages: number[];
}> {
  const pageTexts: string[] = [];
  await pdfParse(pdfBuffer, {
    pagerender: async (pageData: any) => {
      const content = await pageData.getTextContent({ normalizeWhitespace: true, disableCombineTextItems: false });
      const pageText = content.items.map((i: any) => i.str).join('\n');
      pageTexts.push(pageText);
      return pageText;
    }
  });

  const src = await PDFDocument.load(pdfBuffer);
  const recibos: SplitResult[] = [];
  const unmatchedPages: number[] = [];
  const pagesByEmployee = new Map<string, { emp: EmployeeLite; pages: number[]; sueldos: number[] }>();

  for (let pageIdx = 0; pageIdx < src.getPageCount(); pageIdx++) {
    const txt = pageTexts[pageIdx] || '';
    const rawEmp = extractEmployeeName(txt);
    if (!rawEmp) {
      unmatchedPages.push(pageIdx + 1);
      continue;
    }

    const emp = findEmployeeByPdfName(rawEmp, employees);
    if (!emp) {
      unmatchedPages.push(pageIdx + 1);
      continue;
    }

    const current = pagesByEmployee.get(emp.id);
    const sueldoNeto = extractSueldoNeto(txt);
    if (current) {
      current.pages.push(pageIdx);
      if (sueldoNeto > 0) current.sueldos.push(sueldoNeto);
    } else {
      pagesByEmployee.set(emp.id, { emp, pages: [pageIdx], sueldos: sueldoNeto > 0 ? [sueldoNeto] : [] });
    }
  }

  for (const { emp, pages, sueldos } of pagesByEmployee.values()) {
    const one = await PDFDocument.create();
    const copiedPages = await one.copyPages(src, pages);
    for (const p of copiedPages) one.addPage(p);
    const bytes = await one.save();
    const outBuffer = Buffer.from(bytes);
    const checksum = createHash('sha256').update(outBuffer).digest('hex');
    const safeName = `${normalize(emp.lastName)}_${normalize(emp.firstName)}`.replace(/\s+/g, '_');
    const fileName = `recibo_${mesAnio}_${safeName}_${randomUUID().slice(0, 8)}.pdf`;

    recibos.push({
      empleadoId: emp.id,
      empleadoNombre: `${emp.firstName} ${emp.lastName}`,
      fileName,
      buffer: outBuffer,
      checksum,
      sueldoNeto: sueldos.length > 0 ? Math.max(...sueldos) : 0,
      pageCount: pages.length
    });
  }

  return { recibos, unmatchedPages };
}

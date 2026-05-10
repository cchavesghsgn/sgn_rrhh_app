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
      lastParts.every((part) => rawParts.includes(part)) &&
      firstParts.every((part) => rawParts.includes(part))
    );
  });
  if (partial) return partial;

  partial = employees.find((e) => tokenizeName(e.lastName).every((part) => rawParts.includes(part)));
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
  const pagesByEmployee = new Map<string, { emp: EmployeeLite; pages: number[] }>();

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
    if (current) {
      current.pages.push(pageIdx);
    } else {
      pagesByEmployee.set(emp.id, { emp, pages: [pageIdx] });
    }
  }

  for (const { emp, pages } of pagesByEmployee.values()) {
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
      pageCount: pages.length
    });
  }

  return { recibos, unmatchedPages };
}

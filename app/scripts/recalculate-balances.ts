/**
 * Recalculates remaining balances per employee from approved requests since a given date.
 *
 * Balances recalculated:
 * - vacationDays   = totalVacationDays   - approved Vacation days
 * - personalHours  = totalPersonalHours  - approved Personal hours
 * - remoteHours    = totalRemoteHours    - approved Remote hours
 * - availableHours = totalAvailableHours - approved Hours requests
 *
 * By default this script runs in dry-run mode.
 *
 * Usage:
 *   yarn tsx scripts/recalculate-balances.ts --from=2026-01-01
 *   yarn tsx scripts/recalculate-balances.ts --from=2026-01-01 --apply
 *
 * You can also use environment variable:
 *   RECALC_FROM_DATE=2026-01-01 yarn tsx scripts/recalculate-balances.ts --apply
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const HOURS_BY_SHIFT: Record<string, number> = {
  MORNING: 5,
  AFTERNOON: 3,
  FULL_DAY: 8
};

type NormalizedType = 'LICENSE' | 'VACATION' | 'PERSONAL' | 'REMOTE' | 'HOURS';

const fromDbType = (t: string): NormalizedType | null => {
  switch (t) {
    case 'License':
      return 'LICENSE';
    case 'Vacation':
      return 'VACATION';
    case 'Personal':
      return 'PERSONAL';
    case 'Remote':
      return 'REMOTE';
    case 'Hours':
      return 'HOURS';
    default:
      return null;
  }
};

const getArgValue = (name: string): string | undefined => {
  const exact = process.argv.find((arg) => arg.startsWith(`${name}=`));
  if (exact) return exact.split('=').slice(1).join('=');

  const idx = process.argv.findIndex((arg) => arg === name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];

  return undefined;
};

const parseFromDate = (): Date => {
  const raw = getArgValue('--from') || process.env.RECALC_FROM_DATE;
  if (!raw) {
    throw new Error('Missing start date. Provide --from=YYYY-MM-DD or RECALC_FROM_DATE.');
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    throw new Error(`Invalid date format "${raw}". Expected YYYY-MM-DD.`);
  }

  const fromDate = new Date(`${raw}T00:00:00.000Z`);
  if (Number.isNaN(fromDate.getTime())) {
    throw new Error(`Invalid date value "${raw}".`);
  }

  return fromDate;
};

const calculateVacationDays = (startDate: Date, endDate: Date): number => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
};

async function main() {
  const apply = process.argv.includes('--apply');
  const fromDate = parseFromDate();
  const fromDateLabel = fromDate.toISOString().slice(0, 10);

  console.log(
    `Recalculating balances from ${fromDateLabel}${apply ? ' (apply mode)' : ' (dry-run mode)'}...`
  );

  const [employees, approvedRequests] = await Promise.all([
    prisma.employees.findMany({
      select: {
        id: true,
        totalVacationDays: true,
        totalPersonalHours: true,
        totalRemoteHours: true,
        totalAvailableHours: true,
        vacationDays: true,
        personalHours: true,
        remoteHours: true,
        availableHours: true
      }
    }),
    prisma.leave_requests.findMany({
      where: {
        status: 'APPROVED',
        startDate: { gte: fromDate }
      },
      select: {
        employeeId: true,
        type: true,
        startDate: true,
        endDate: true,
        hours: true,
        shift: true
      }
    })
  ]);

  const usageByEmployee = new Map<
    string,
    {
      vacationDaysUsed: number;
      personalHoursUsed: number;
      remoteHoursUsed: number;
      availableHoursUsed: number;
    }
  >();

  for (const req of approvedRequests) {
    const normalizedType = fromDbType(req.type as unknown as string);
    if (!normalizedType) continue;

    const usage = usageByEmployee.get(req.employeeId) || {
      vacationDaysUsed: 0,
      personalHoursUsed: 0,
      remoteHoursUsed: 0,
      availableHoursUsed: 0
    };

    switch (normalizedType) {
      case 'VACATION':
        usage.vacationDaysUsed += calculateVacationDays(req.startDate, req.endDate);
        break;
      case 'PERSONAL':
        usage.personalHoursUsed += req.shift ? HOURS_BY_SHIFT[req.shift] || 8 : 8;
        break;
      case 'REMOTE':
        usage.remoteHoursUsed += req.shift ? HOURS_BY_SHIFT[req.shift] || 8 : 8;
        break;
      case 'HOURS':
        usage.availableHoursUsed += req.hours || 0;
        break;
      case 'LICENSE':
        // LICENSE does not consume balance pools.
        break;
    }

    usageByEmployee.set(req.employeeId, usage);
  }

  let changedEmployees = 0;
  let updatedEmployees = 0;

  for (const emp of employees) {
    const usage = usageByEmployee.get(emp.id) || {
      vacationDaysUsed: 0,
      personalHoursUsed: 0,
      remoteHoursUsed: 0,
      availableHoursUsed: 0
    };

    const expected = {
      vacationDays: Math.max(0, emp.totalVacationDays - usage.vacationDaysUsed),
      personalHours: Math.max(0, emp.totalPersonalHours - usage.personalHoursUsed),
      remoteHours: Math.max(0, emp.totalRemoteHours - usage.remoteHoursUsed),
      availableHours: Math.max(0, emp.totalAvailableHours - usage.availableHoursUsed)
    };

    const hasChanges =
      emp.vacationDays !== expected.vacationDays ||
      emp.personalHours !== expected.personalHours ||
      emp.remoteHours !== expected.remoteHours ||
      emp.availableHours !== expected.availableHours;

    if (!hasChanges) continue;

    changedEmployees++;
    console.log(
      `- ${emp.id}\n` +
        `  vacationDays: ${emp.vacationDays} -> ${expected.vacationDays}\n` +
        `  personalHours: ${emp.personalHours} -> ${expected.personalHours}\n` +
        `  remoteHours: ${emp.remoteHours} -> ${expected.remoteHours}\n` +
        `  availableHours: ${emp.availableHours} -> ${expected.availableHours}`
    );

    if (apply) {
      await prisma.employees.update({
        where: { id: emp.id },
        data: expected
      });
      updatedEmployees++;
    }
  }

  if (apply) {
    console.log(`Done. Employees changed: ${changedEmployees}. Employees updated: ${updatedEmployees}.`);
  } else {
    console.log(`Dry-run complete. Employees with differences: ${changedEmployees}.`);
    console.log('Re-run with --apply to persist changes.');
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

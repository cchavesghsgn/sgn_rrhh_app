/**
 * Reconciles employees.availableHours with approved HOURS requests.
 * - Computes: availableHours = totalAvailableHours - SUM(approved HOURS hours)
 * - Dry-run by default. Pass --apply to write changes.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const fromDbType = (t: string) => {
  switch (t) {
    case 'License': return 'LICENSE';
    case 'Personal': return 'PERSONAL';
    case 'Remote': return 'REMOTE';
    case 'Hours': return 'HOURS';
    default: return t;
  }
};

async function main() {
  const apply = process.argv.includes('--apply');
  console.log(`Reconciling available hours${apply ? ' (apply mode)' : ' (dry-run)'}...`);

  const employees = await prisma.employees.findMany({});

  let updated = 0;
  for (const emp of employees) {
    // Sum approved HOURS requests
    const requests = await prisma.leave_requests.findMany({
      where: { employeeId: emp.id, status: 'APPROVED' },
      select: { type: true, hours: true }
    });

    const approvedHours = requests
      .filter(r => fromDbType(r.type as unknown as string) === 'HOURS')
      .reduce((sum, r) => sum + (r.hours || 0), 0);

    const expected = Math.max(0, (emp.totalAvailableHours || 0) - approvedHours);
    if (emp.availableHours !== expected) {
      console.log(`- ${emp.id}: ${emp.availableHours} -> ${expected} (total ${emp.totalAvailableHours}, approved ${approvedHours})`);
      if (apply) {
        await prisma.employees.update({ where: { id: emp.id }, data: { availableHours: expected } });
        updated++;
      }
    }
  }

  if (apply) {
    console.log(`Done. Employees updated: ${updated}`);
  } else {
    console.log('Dry-run complete. Re-run with --apply to persist changes.');
  }
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });


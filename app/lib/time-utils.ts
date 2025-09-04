

/**
 * Utilidades para el manejo de tiempo y cálculo de permisos
 * Sistema: Mañana (5h) + Tarde (3h) = Día completo (8h)
 */

export const SHIFT_HOURS = {
  MORNING: 5,
  AFTERNOON: 3,
  FULL_DAY: 8
} as const;

/**
 * Convierte horas disponibles a un formato legible para el usuario
 * @param totalHours Total de horas disponibles
 * @returns String formateado (ej: "2 días y 1 tarde", "1 mañana", "3 días")
 */
export function formatAvailableTime(totalHours: number): string {
  if (totalHours <= 0) return '0 días';
  
  const fullDays = Math.floor(totalHours / 8);
  const remainingHours = totalHours % 8;
  
  const parts: string[] = [];
  
  if (fullDays > 0) {
    parts.push(`${fullDays} día${fullDays > 1 ? 's' : ''}`);
  }
  
  if (remainingHours === 5) {
    parts.push('1 mañana');
  } else if (remainingHours === 3) {
    parts.push('1 tarde');
  }
  
  return parts.join(' y ') || '0 días';
}

/**
 * Convierte horas disponibles a días decimales para compatibilidad
 * @param totalHours Total de horas disponibles
 * @returns Número de días en decimal (ej: 2.5 días)
 */
export function hoursToDays(totalHours: number): number {
  return Math.round((totalHours / 8) * 100) / 100;
}

/**
 * Convierte días decimales a horas
 * @param days Días en decimal
 * @returns Total de horas
 */
export function daysToHours(days: number): number {
  return Math.round(days * 8);
}

/**
 * Valida si el empleado puede solicitar un turno específico
 * @param availableHours Horas disponibles del empleado
 * @param requestedShift Turno solicitado (MORNING, AFTERNOON, FULL_DAY)
 * @returns true si puede solicitar el turno
 */
export function canRequestShift(availableHours: number, requestedShift: string): boolean {
  switch (requestedShift) {
    case 'MORNING':
      return availableHours >= SHIFT_HOURS.MORNING;
    case 'AFTERNOON':
      return availableHours >= SHIFT_HOURS.AFTERNOON;
    case 'FULL_DAY':
      return availableHours >= SHIFT_HOURS.FULL_DAY;
    default:
      return false;
  }
}

/**
 * Calcula las horas que se deben deducir según el tipo de turno
 * @param shift Turno solicitado (MORNING, AFTERNOON, FULL_DAY)
 * @returns Número de horas a deducir
 */
export function calculateHoursToDeduct(shift: string): number {
  switch (shift) {
    case 'MORNING':
      return SHIFT_HOURS.MORNING;
    case 'AFTERNOON':
      return SHIFT_HOURS.AFTERNOON;
    case 'FULL_DAY':
      return SHIFT_HOURS.FULL_DAY;
    default:
      return 0;
  }
}

/**
 * Formatea días personales disponibles desde horas almacenadas en BD
 * @param employee Datos del empleado
 * @returns String formateado con disponibilidad
 */
export function formatAvailablePersonalDays(employee: any): string {
  const availableHours = employee.personalHours || 0;
  
  if (availableHours <= 0) return '0 días';
  
  const fullDays = Math.floor(availableHours / 8);
  const remainingHours = availableHours % 8;
  
  const parts: string[] = [];
  
  if (fullDays > 0) {
    parts.push(`${fullDays} día${fullDays > 1 ? 's' : ''}`);
  }
  
  if (remainingHours === 5) {
    parts.push('1 mañana');
  } else if (remainingHours === 3) {
    parts.push('1 tarde');
  }
  
  return parts.join(' y ') || '0 días';
}

/**
 * Formatea días remotos disponibles desde horas almacenadas en BD
 * @param employee Datos del empleado
 * @returns String formateado con disponibilidad
 */
export function formatAvailableRemoteDays(employee: any): string {
  const availableHours = employee.remoteHours || 0;
  
  if (availableHours <= 0) return '0 días';
  
  const fullDays = Math.floor(availableHours / 8);
  const remainingHours = availableHours % 8;
  
  const parts: string[] = [];
  
  if (fullDays > 0) {
    parts.push(`${fullDays} día${fullDays > 1 ? 's' : ''}`);
  }
  
  if (remainingHours === 5) {
    parts.push('1 mañana');
  } else if (remainingHours === 3) {
    parts.push('1 tarde');
  }
  
  return parts.join(' y ') || '0 días';
}

/**
 * Calcula los días y turnos disponibles desde días guardados en BD
 * @param availableDays Días disponibles (cada día = 8 horas)
 * @param usedHours Horas ya utilizadas en solicitudes
 * @returns String formateado con disponibilidad
 */
export function formatAvailableDays(availableDays: number, usedHours: number = 0): string {
  if (availableDays <= 0) return '0 días';
  
  // Convertir días a horas y restar horas usadas
  const totalAvailableHours = (availableDays * 8) - usedHours;
  
  if (totalAvailableHours <= 0) return '0 días';
  
  const fullDays = Math.floor(totalAvailableHours / 8);
  const remainingHours = totalAvailableHours % 8;
  
  const parts: string[] = [];
  
  if (fullDays > 0) {
    parts.push(`${fullDays} día${fullDays > 1 ? 's' : ''}`);
  }
  
  if (remainingHours === 5) {
    parts.push('1 mañana');
  } else if (remainingHours === 3) {
    parts.push('1 tarde');
  }
  
  return parts.join(' y ') || '0 días';
}

/**
 * Calcula el total de licencias tomadas en días
 * @param employee Datos del empleado (debe incluir leave_requests)
 * @returns Total de días de licencias utilizados
 */
export function calculateTotalLicensesTaken(employee: any): number {
  // Solo contar solicitudes de tipo LICENSE aprobadas
  if (!employee.leave_requests) {
    return 0;
  }
  
  const licenseRequests = employee.leave_requests.filter(
    (request: any) => request.type === 'LICENSE' && request.status === 'APPROVED'
  );
  
  let totalLicenseDays = 0;
  
  for (const request of licenseRequests) {
    if (request.endDate) {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      let days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      
      // Si es medio día, contar como 0.5
      if (request.isHalfDay && days === 1) {
        days = 0.5;
      }
      
      totalLicenseDays += days;
    }
  }
  
  return totalLicenseDays;
}

/**
 * Formatea horas disponibles específicas (para el campo availableHours)
 * Esta función mantiene la lógica original para horas específicas
 */
export function formatAvailableHours(availableHours: number): string {
  return formatAvailableTime(availableHours);
}

/**
 * Formatea un total de horas como "X días y Y horas"
 *  - 20 -> "2 días y 4 horas"
 *  - 8  -> "1 día"
 *  - 0  -> "0 horas"
 */
export function formatDaysAndHours(totalHours: number): string {
  const hours = Math.max(0, Math.floor(totalHours || 0));
  const days = Math.floor(hours / 8);
  const rem = hours % 8;

  const parts: string[] = [];
  if (days > 0) parts.push(`${days} día${days > 1 ? 's' : ''}`);
  if (rem > 0) parts.push(`${rem} hora${rem > 1 ? 's' : ''}`);
  if (parts.length === 0) return '0 horas';
  return parts.join(' y ');
}

/**
 * Formatea disponibilidad y total en días: "X días y Y horas de N días"
 * Ej.: available=20, total=96 -> "2 días y 4 horas de 12 días"
 */
export function formatHoursOfTotalDays(availableHours: number, totalHours: number): string {
  const left = formatDaysAndHours(availableHours || 0);
  const totalDays = Math.floor((totalHours || 0) / 8);
  return `${left} de ${totalDays} día${totalDays === 1 ? '' : 's'}`;
}

/**
 * Obtiene un resumen detallado de las horas disponibles
 * @param totalHours Total de horas disponibles
 * @returns Objeto con desglose detallado
 */
export function getTimeBreakdown(totalHours: number) {
  const fullDays = Math.floor(totalHours / 8);
  const remainingHours = totalHours % 8;
  
  let mornings = fullDays;
  let afternoons = fullDays;
  
  if (remainingHours >= 5) {
    mornings += 1;
  }
  
  if (remainingHours >= 3) {
    afternoons += 1;
  }
  
  return {
    totalHours,
    fullDays,
    remainingHours,
    availableMornings: mornings,
    availableAfternoons: afternoons,
    formattedTime: formatAvailableTime(totalHours),
    daysEquivalent: hoursToDays(totalHours)
  };
}

/**
 * Calcula la antigüedad en años basada en la fecha de ingreso
 * @param hireDate Fecha de ingreso del empleado (formato YYYY-MM-DD o Date)
 * @returns Número de años de antigüedad con decimales
 */
export function calculateYearsOfService(hireDate: string | Date): number {
  if (!hireDate) return 0;
  
  const hire = new Date(hireDate);
  const today = new Date();
  
  if (isNaN(hire.getTime())) return 0;
  
  // Calcular diferencia en años
  let years = today.getFullYear() - hire.getFullYear();
  const monthDiff = today.getMonth() - hire.getMonth();
  const dayDiff = today.getDate() - hire.getDate();
  
  // Ajustar si aún no cumplió años en el año actual
  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    years--;
  }
  
  return years;
}

/**
 * Formatea la antigüedad para mostrar en la interfaz
 * @param hireDate Fecha de ingreso del empleado
 * @returns String formateado con la antigüedad (ej: "3 años", "1 año", "menos de 1 año")
 */
export function formatYearsOfService(hireDate: string | Date): string {
  const years = calculateYearsOfService(hireDate);
  
  if (years === 0) {
    return 'Menos de 1 año';
  } else if (years === 1) {
    return '1 año';
  } else {
    return `${years} años`;
  }
}

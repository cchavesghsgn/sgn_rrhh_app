
export interface User {
  id: string;
  email: string;
  name?: string;
  role: UserRole;
  image?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Employee {
  id: string;
  userId: string;
  dni: string;
  firstName: string;
  lastName: string;
  birthDate: Date;
  hireDate: Date;
  areaId: string;
  position: string;
  phone?: string;
  photo?: string;
  vacationDays: number;
  personalDays: number;
  remoteDays: number;
  availableHours: number;
  totalVacationDays: number;
  totalPersonalDays: number;
  totalRemoteDays: number;
  totalAvailableHours: number;
  createdAt: Date;
  updatedAt: Date;
  user?: User;
  area?: Area;
  leaveRequests?: LeaveRequest[];
}

export interface Area {
  id: string;
  name: string;
  description?: string;
  createdAt: Date;
  updatedAt: Date;
  employees?: Employee[];
}

export interface LeaveRequest {
  id: string;
  employeeId: string;
  type: LeaveRequestType;
  startDate: Date;
  endDate: Date;
  isHalfDay: boolean;
  hours?: number;
  startTime?: string;
  endTime?: string;
  shift?: DayShift;
  reason: string;
  status: RequestStatus;
  adminNotes?: string;
  createdAt: Date;
  updatedAt: Date;
  employee?: Employee;
  attachments?: Attachment[];
}

export interface Attachment {
  id: string;
  leaveRequestId: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  createdAt: Date;
}

export enum UserRole {
  EMPLOYEE = 'EMPLOYEE',
  ADMIN = 'ADMIN'
}

export enum LeaveRequestType {
  LICENSE = 'LICENSE',
  PERSONAL = 'PERSONAL',
  REMOTE = 'REMOTE',
  HOURS = 'HOURS'
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export enum DayShift {
  MORNING = 'MORNING',
  AFTERNOON = 'AFTERNOON',
  FULL_DAY = 'FULL_DAY'
}

export interface DashboardStats {
  totalEmployees: number;
  pendingRequests: number;
  approvedRequests: number;
  rejectedRequests: number;
}

export interface EmployeeDashboardData {
  employee: Employee;
  recentRequests: LeaveRequest[];
  availableDays: {
    vacation: number;
    personal: number;
    remote: number;
    hours: number;
  };
}

export const LEAVE_REQUEST_TYPE_LABELS = {
  [LeaveRequestType.LICENSE]: 'Licencia',
  [LeaveRequestType.PERSONAL]: 'Día Personal',
  [LeaveRequestType.REMOTE]: 'Día Remoto',
  [LeaveRequestType.HOURS]: 'Pedido de Horas'
};

export const REQUEST_STATUS_LABELS = {
  [RequestStatus.PENDING]: 'Pendiente',
  [RequestStatus.APPROVED]: 'Aprobada',
  [RequestStatus.REJECTED]: 'Rechazada'
};

export const DAY_SHIFT_LABELS = {
  [DayShift.MORNING]: 'Mañana',
  [DayShift.AFTERNOON]: 'Tarde',
  [DayShift.FULL_DAY]: 'Todo el día'
};

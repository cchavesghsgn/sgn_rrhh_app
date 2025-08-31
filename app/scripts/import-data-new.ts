import { PrismaClient, UserRole, LeaveRequestType, RequestStatus, DayShift } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

interface ImportData {
  timestamp: string;
  version: string;
  counts: {
    areas: number;
    users: number;
    employees: number;
    leaveRequests: number;
    attachments: number;
  };
  data: {
    areas: Array<{
      id: string;
      name: string;
      description: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    users: Array<{
      id: string;
      email: string;
      password: string;
      name: string | null;
      role: UserRole;
      createdAt: string;
      updatedAt: string;
    }>;
    employees: Array<{
      id: string;
      userId: string;
      dni: string;
      firstName: string;
      lastName: string;
      birthDate: string;
      hireDate: string;
      areaId: string;
      position: string;
      phone: string | null;
      photo: string | null;
      vacationDays: number;
      personalHours: number;
      remoteHours: number;
      availableHours: number;
      totalVacationDays: number;
      totalPersonalHours: number;
      totalRemoteHours: number;
      totalAvailableHours: number;
      createdAt: string;
      updatedAt: string;
    }>;
    leaveRequests: Array<{
      id: string;
      employeeId: string;
      type: LeaveRequestType;
      startDate: string;
      endDate: string;
      isHalfDay: boolean;
      hours: number | null;
      startTime: string | null;
      endTime: string | null;
      shift: DayShift | null;
      reason: string;
      status: RequestStatus;
      adminNotes: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    attachments: Array<{
      id: string;
      leaveRequestId: string;
      fileName: string;
      originalName: string;
      filePath: string;
      fileType: string;
      fileSize: number;
      createdAt: string;
    }>;
  };
}

async function importData() {
  try {
    console.log('📥 Iniciando importación de datos...');

    // Leer archivo de exportación
    const exportPath = path.join(process.cwd(), 'exports', 'export-2025-08-31T03-14-47-628Z.json');
    if (!fs.existsSync(exportPath)) {
      throw new Error('No se encontró el archivo de exportación');
    }

    const data: ImportData = JSON.parse(fs.readFileSync(exportPath, 'utf-8'));
    
    console.log(`📊 Datos a importar:
    - Áreas: ${data.counts.areas}
    - Usuarios: ${data.counts.users}
    - Empleados: ${data.counts.employees}
    - Solicitudes: ${data.counts.leaveRequests}
    - Adjuntos: ${data.counts.attachments}
    `);

    // Verificar conexión
    await prisma.$connect();
    console.log('✅ Conexión establecida con la base de datos');

    // Limpiar datos existentes en orden inverso a las dependencias
    console.log('🧹 Limpiando datos existentes...');
    await prisma.attachments.deleteMany();
    await prisma.leave_requests.deleteMany();
    await prisma.employees.deleteMany();
    await prisma.session.deleteMany();
    await prisma.account.deleteMany();
    await prisma.user.deleteMany();
    await prisma.area.deleteMany();

    // Importar datos en orden de dependencias
    await prisma.$transaction(async (tx) => {
      // 1. Áreas
      console.log('Importando áreas...');
      for (const area of data.data.areas) {
        await tx.area.create({
          data: {
            id: area.id,
            name: area.name,
            description: area.description,
            createdAt: new Date(area.createdAt),
            updatedAt: new Date(area.updatedAt)
          }
        });
      }
      console.log(`✅ ${data.counts.areas} áreas importadas`);

      // 2. Usuarios
      console.log('Importando usuarios...');
      for (const user of data.data.users) {
        await tx.user.create({
          data: {
            id: user.id,
            email: user.email,
            password: user.password,
            name: user.name,
            role: user.role as UserRole,
            createdAt: new Date(user.createdAt),
            updatedAt: new Date(user.updatedAt)
          }
        });
      }
      console.log(`✅ ${data.counts.users} usuarios importados`);

      // 3. Empleados
      console.log('Importando empleados...');
      for (const emp of data.data.employees) {
        await tx.employees.create({
          data: {
            id: emp.id,
            userId: emp.userId,
            dni: emp.dni,
            firstName: emp.firstName,
            lastName: emp.lastName,
            birthDate: new Date(emp.birthDate),
            hireDate: new Date(emp.hireDate),
            areaId: emp.areaId,
            position: emp.position,
            phone: emp.phone,
            photo: emp.photo,
            vacationDays: emp.vacationDays,
            personalHours: emp.personalHours,
            remoteHours: emp.remoteHours,
            availableHours: emp.availableHours,
            totalVacationDays: emp.totalVacationDays,
            totalPersonalHours: emp.totalPersonalHours,
            totalRemoteHours: emp.totalRemoteHours,
            totalAvailableHours: emp.totalAvailableHours,
            createdAt: new Date(emp.createdAt),
            updatedAt: new Date(emp.updatedAt)
          }
        });
      }
      console.log(`✅ ${data.counts.employees} empleados importados`);

      // 4. Solicitudes
      console.log('Importando solicitudes...');
      for (const req of data.data.leaveRequests) {
        console.log('Tipo de solicitud:', req.type);
        await tx.leave_requests.create({
          data: {
            id: req.id,
            employeeId: req.employeeId,
            type: req.type.charAt(0).toUpperCase() + req.type.slice(1).toLowerCase() as LeaveRequestType,
            startDate: new Date(req.startDate),
            endDate: new Date(req.endDate),
            isHalfDay: req.isHalfDay,
            hours: req.hours,
            startTime: req.startTime,
            endTime: req.endTime,
            shift: req.shift as DayShift | null,
            reason: req.reason,
            status: req.status as RequestStatus,
            adminNotes: req.adminNotes,
            createdAt: new Date(req.createdAt),
            updatedAt: new Date(req.updatedAt)
          }
        });
      }
      console.log(`✅ ${data.counts.leaveRequests} solicitudes importadas`);

      // 5. Adjuntos
      if (data.counts.attachments > 0) {
        console.log('Importando adjuntos...');
        for (const att of data.data.attachments) {
          await tx.attachments.create({
            data: {
              id: att.id,
              leaveRequestId: att.leaveRequestId,
              fileName: att.fileName,
              originalName: att.originalName,
              filePath: att.filePath,
              fileType: att.fileType,
              fileSize: att.fileSize,
              createdAt: new Date(att.createdAt)
            }
          });
        }
        console.log(`✅ ${data.counts.attachments} adjuntos importados`);
      }
    });

    console.log('✅ Importación completada exitosamente');
  } catch (error) {
    console.error('❌ Error durante la importación:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Ejecutar importación
importData()
  .catch((error) => {
    console.error('❌ Error fatal:', error);
    process.exit(1);
  });


'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Calendar,
  Clock,
  FileText,
  Plus,
  Home,
  Laptop,
  User,
  Phone,
  MapPin,
  Mail,
  Building2
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Employee, LeaveRequest, LEAVE_REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS, DAY_SHIFT_LABELS } from '../lib/types';
import { formatAvailableTime, getTimeBreakdown, formatYearsOfService, formatHoursOfTotalDays } from '../lib/time-utils';

export default function EmployeeDashboard() {
  const { data: session } = useSession();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [recentRequests, setRecentRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchEmployeeData = async () => {
      try {
        const [employeeRes, requestsRes] = await Promise.all([
          fetch('/api/employees/me'),
          fetch('/api/leave-requests')
        ]);

        if (employeeRes.ok) {
          const employeeData = await employeeRes.json();
          setEmployee(employeeData);
        }

        if (requestsRes.ok) {
          const requestsData = await requestsRes.json();
          setRecentRequests(requestsData.slice(0, 5));
        }
      } catch (error) {
        console.error('Error fetching employee data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (session?.user) {
      fetchEmployeeData();
    }
  }, [session]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'approved';
      case 'REJECTED': return 'rejected';
      default: return 'pending';
    }
  };

  // Formatear información adicional de la solicitud (período/horas)
  const formatRequestDetails = (request: LeaveRequest) => {
    if (request.type === 'HOURS') {
      if (request.startTime && request.endTime) {
        return `${request.startTime} - ${request.endTime} (${request.hours}h)`;
      }
      return `${request.hours} horas`;
    }
    
    if ((request.type === 'PERSONAL' || request.type === 'REMOTE') && request.shift) {
      return DAY_SHIFT_LABELS[request.shift as keyof typeof DAY_SHIFT_LABELS];
    }
    
    if (request.type === 'LICENSE') {
      const start = new Date(request.startDate);
      const end = new Date(request.endDate);
      const diffTime = end.getTime() - start.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      
      if (request.isHalfDay && diffDays === 1) {
        return '0.5 días';
      }
      
      return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
    }
    
    // Para días particulares, remotos, etc. que no tengan shift específico
    if (request.shift) {
      return DAY_SHIFT_LABELS[request.shift as keyof typeof DAY_SHIFT_LABELS];
    }
    
    return 'Todo el día'; // Default para días completos
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-32 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No se encontraron datos del empleado.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-sgn-dark mb-2">
          ¡Bienvenido, {employee.firstName}!
        </h1>
        <p className="text-gray-600">
          Gestiona tus solicitudes y consulta tu información personal
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Licenses taken */}
        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <FileText className="h-6 w-6 text-sgn-blue mx-auto mb-2" />
            <p className="text-xl font-bold text-sgn-dark">
              {(employee.licensesTakenDays || 0)} días
            </p>
            <p className="text-sm text-gray-600">Licencias tomadas</p>
          </CardContent>
        </Card>
        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <Calendar className="h-6 w-6 text-sgn-blue mx-auto mb-2" />
            <p className="text-xl font-bold text-sgn-dark">
              {employee.vacationDays} de {employee.totalVacationDays}
            </p>
            <p className="text-sm text-gray-600">Días de vacaciones</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <User className="h-6 w-6 text-sgn-blue mx-auto mb-2" />
            <p className="text-xl font-bold text-sgn-dark">
              {formatHoursOfTotalDays(employee.personalHours || 0, employee.totalPersonalHours || 0)}
            </p>
            <p className="text-sm text-gray-600">Días particulares</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <Laptop className="h-6 w-6 text-sgn-blue mx-auto mb-2" />
            <p className="text-xl font-bold text-sgn-dark">
              {formatHoursOfTotalDays(employee.remoteHours || 0, employee.totalRemoteHours || 0)}
            </p>
            <p className="text-sm text-gray-600">Días remotos</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 text-sgn-blue mx-auto mb-2" />
            <p className="text-xl font-bold text-sgn-dark">
              {(employee.availableHours || 0)} de {(employee.totalAvailableHours || 0)} horas
            </p>
            <p className="text-sm text-gray-600">Horas disponibles</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Personal Information */}
        <Card className="sgn-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5 text-sgn-blue" />
              Información Personal
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Employee Photo */}
            <div className="flex justify-center mb-4">
              <div className="relative w-24 h-24 rounded-full overflow-hidden bg-gray-200">
                {employee.photo ? (
                  <Image
                    src={employee.photo}
                    alt={`${employee.firstName} ${employee.lastName}`}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="h-10 w-10 text-gray-400" />
                  </div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">DNI</p>
                <p className="font-medium">{employee.dni}</p>
              </div>
              <div>
                <p className="text-gray-600">Nombre</p>
                <p className="font-medium">{employee.firstName} {employee.lastName}</p>
              </div>
              <div>
                <p className="text-gray-600">Email</p>
                <p className="font-medium">{employee.user?.email}</p>
              </div>
              <div>
                <p className="text-gray-600">Teléfono</p>
                <p className="font-medium">{employee.phone || 'No especificado'}</p>
              </div>
              <div>
                <p className="text-gray-600">Área</p>
                <p className="font-medium">{employee.area?.name}</p>
              </div>
              <div>
                <p className="text-gray-600">Cargo</p>
                <p className="font-medium">{employee.position}</p>
              </div>
              <div>
                <p className="text-gray-600">Fecha de ingreso</p>
                <p className="font-medium">{formatDate(employee.hireDate.toString())}</p>
              </div>
              <div>
                <p className="text-gray-600">Antigüedad</p>
                <p className="font-medium">{formatYearsOfService(employee.hireDate)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Requests */}
        <Card className="sgn-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sgn-blue" />
              Solicitudes Recientes
            </CardTitle>
            <Link href="/requests">
              <Button size="sm" variant="outline">
                Ver todas
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {recentRequests.length > 0 ? (
              <div className="space-y-3">
                {recentRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {LEAVE_REQUEST_TYPE_LABELS[request.type]}
                      </p>
                      <p className="text-xs text-gray-600 mb-1">
                        {request.type === 'LICENSE' 
                          ? `${formatDate(request.startDate.toString())} - ${formatDate(request.endDate.toString())}`
                          : formatDate(request.startDate.toString())
                        }
                      </p>
                      <div className="flex items-center gap-1 text-xs text-gray-500">
                        <Clock className="h-3 w-3" />
                        <span>{formatRequestDetails(request)}</span>
                      </div>
                    </div>
                    <Badge variant={getStatusBadgeVariant(request.status)}>
                      {REQUEST_STATUS_LABELS[request.status]}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-6">
                No tienes solicitudes recientes
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="sgn-card">
        <CardHeader>
          <CardTitle>Acciones Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/requests/new">
              <Button className="w-full h-16 flex-col gap-2">
                <Plus className="h-6 w-6" />
                Nueva Solicitud
              </Button>
            </Link>
            
            <Link href="/requests">
              <Button variant="outline" className="w-full h-16 flex-col gap-2">
                <FileText className="h-6 w-6" />
                Ver Solicitudes
              </Button>
            </Link>

            <Button variant="outline" disabled className="w-full h-16 flex-col gap-2 opacity-50 cursor-not-allowed">
              <User className="h-6 w-6" />
              Mi Perfil
            </Button>

            <Button variant="outline" className="w-full h-16 flex-col gap-2" disabled>
              <Calendar className="h-6 w-6" />
              Calendario
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

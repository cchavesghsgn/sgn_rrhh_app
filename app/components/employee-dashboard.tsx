
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
import { Employee, LeaveRequest, LEAVE_REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from '../lib/types';
import { formatAvailableTime, formatAvailableDays, getTimeBreakdown } from '../lib/time-utils';

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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="sgn-card">
          <CardContent className="p-6 text-center">
            <Calendar className="h-8 w-8 text-sgn-blue mx-auto mb-2" />
            <p className="text-2xl font-bold text-sgn-dark">
              {employee.vacationDays} de {employee.totalVacationDays}
            </p>
            <p className="text-sm text-gray-600">Días de vacaciones</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-6 text-center">
            <User className="h-8 w-8 text-sgn-blue mx-auto mb-2" />
            <p className="text-2xl font-bold text-sgn-dark">
              {formatAvailableDays(employee.personalDays || 0)}
            </p>
            <p className="text-xs text-gray-500 mb-1">
              {employee.personalDays || 0} de {employee.totalPersonalDays || 12} días
            </p>
            <p className="text-sm text-gray-600">Días personales</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-6 text-center">
            <Laptop className="h-8 w-8 text-sgn-blue mx-auto mb-2" />
            <p className="text-2xl font-bold text-sgn-dark">
              {formatAvailableDays(employee.remoteDays || 0)}
            </p>
            <p className="text-xs text-gray-500 mb-1">
              {employee.remoteDays || 0} de {employee.totalRemoteDays || 12} días
            </p>
            <p className="text-sm text-gray-600">Días remotos</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-6 text-center">
            <Clock className="h-8 w-8 text-sgn-blue mx-auto mb-2" />
            <p className="text-2xl font-bold text-sgn-dark">
              {employee.availableHours} de {employee.totalAvailableHours}
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
                    <div>
                      <p className="font-medium text-sm">
                        {LEAVE_REQUEST_TYPE_LABELS[request.type]}
                      </p>
                      <p className="text-xs text-gray-600">
                        {formatDate(request.startDate.toString())} - {formatDate(request.endDate.toString())}
                      </p>
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

            <Link href="/profile">
              <Button variant="outline" className="w-full h-16 flex-col gap-2">
                <User className="h-6 w-6" />
                Mi Perfil
              </Button>
            </Link>

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


'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Plus,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import { Employee, LeaveRequest, Area, LEAVE_REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from '../lib/types';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0
  });
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const [employeesRes, requestsRes] = await Promise.all([
          fetch('/api/employees'),
          fetch('/api/leave-requests')
        ]);

        if (employeesRes.ok) {
          const employeesData = await employeesRes.json();
          setEmployees(employeesData);
          setStats(prev => ({ ...prev, totalEmployees: employeesData.length }));
        }

        if (requestsRes.ok) {
          const requestsData = await requestsRes.json();
          const pendingOnly = requestsData.filter((r: LeaveRequest) => r.status === 'PENDING');
          setPendingRequests(pendingOnly.slice(0, 10));
          
          const pendingCount = pendingOnly.length;
          const approvedCount = requestsData.filter((r: LeaveRequest) => r.status === 'APPROVED').length;
          const rejectedCount = requestsData.filter((r: LeaveRequest) => r.status === 'REJECTED').length;
          
          setStats(prev => ({
            ...prev,
            pendingRequests: pendingCount,
            approvedRequests: approvedCount,
            rejectedRequests: rejectedCount
          }));
        }
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
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

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Welcome Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-sgn-dark mb-2">
          Panel de Administración
        </h1>
        <p className="text-gray-600">
          Gestiona empleados, solicitudes y configuraciones del sistema
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="sgn-card">
          <CardContent className="p-6 text-center">
            <Users className="h-8 w-8 text-sgn-blue mx-auto mb-2" />
            <p className="text-2xl font-bold text-sgn-dark">{stats.totalEmployees}</p>
            <p className="text-sm text-gray-600">Total Empleados</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-6 text-center">
            <Clock className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-yellow-600">{stats.pendingRequests}</p>
            <p className="text-sm text-gray-600">Solicitudes Pendientes</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-6 text-center">
            <CheckCircle className="h-8 w-8 text-green-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-green-600">{stats.approvedRequests}</p>
            <p className="text-sm text-gray-600">Aprobadas</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-6 text-center">
            <XCircle className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <p className="text-2xl font-bold text-red-600">{stats.rejectedRequests}</p>
            <p className="text-sm text-gray-600">Rechazadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Requests */}
        <Card className="sgn-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sgn-blue" />
              Solicitudes Pendientes
            </CardTitle>
            <Link href="/admin/requests">
              <Button size="sm" variant="outline">
                Ver todas
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {pendingRequests.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {pendingRequests.map((request) => (
                  <div
                    key={request.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {request.employee?.firstName} {request.employee?.lastName}
                      </p>
                      <p className="text-xs text-gray-600">
                        {LEAVE_REQUEST_TYPE_LABELS[request.type]} • {formatDate(request.startDate.toString())}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={getStatusBadgeVariant(request.status)}>
                        {REQUEST_STATUS_LABELS[request.status]}
                      </Badge>
                      <Link href={`/admin/requests/${request.id}`}>
                        <Button size="sm" variant="outline">
                          <Eye className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-6">
                No hay solicitudes pendientes
              </p>
            )}
          </CardContent>
        </Card>

        {/* Employee List */}
        <Card className="sgn-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-sgn-blue" />
              Lista de Empleados
            </CardTitle>
            <Link href="/admin/employees">
              <Button size="sm" variant="outline">
                Ver todos
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {employees.length > 0 ? (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {employees.slice(0, 8).map((employee) => (
                  <div
                    key={employee.id}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {employee.firstName} {employee.lastName}
                      </p>
                      <p className="text-xs text-gray-600">
                        {employee.position} • {employee.area?.name}
                      </p>
                      <div className="grid grid-cols-2 gap-2 mt-2 text-xs text-gray-600">
                        <span>Vacaciones: {employee.vacationDays}/{employee.totalVacationDays}</span>
                        <span>Personales: {employee.personalDays}/{employee.totalPersonalDays}</span>
                        <span>Remotos: {employee.remoteDays}/{employee.totalRemoteDays}</span>
                        <span>Horas: {employee.availableHours}/{employee.totalAvailableHours}</span>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant={employee.user?.role === 'ADMIN' ? 'secondary' : 'default'}>
                        {employee.user?.role === 'ADMIN' ? 'Admin' : 'Empleado'}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-600 text-center py-6">
                No hay empleados registrados
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="sgn-card">
        <CardHeader>
          <CardTitle>Acciones Administrativas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/employees/new">
              <Button className="w-full h-16 flex-col gap-2">
                <Plus className="h-6 w-6" />
                Nuevo Empleado
              </Button>
            </Link>
            
            <Link href="/admin/requests">
              <Button variant="outline" className="w-full h-16 flex-col gap-2">
                <FileText className="h-6 w-6" />
                Gestionar Solicitudes
              </Button>
            </Link>

            <Link href="/admin/areas">
              <Button variant="outline" className="w-full h-16 flex-col gap-2">
                <Building2 className="h-6 w-6" />
                Gestionar Áreas
              </Button>
            </Link>

            <Link href="/admin/employees">
              <Button variant="outline" className="w-full h-16 flex-col gap-2">
                <Users className="h-6 w-6" />
                Ver Empleados
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

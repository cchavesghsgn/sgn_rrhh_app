
'use client';

import { useEffect, useState, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from './ui/dialog';
import { 
  Users,
  FileText,
  CheckCircle,
  XCircle,
  Clock,
  Building2,
  Plus,
  Eye,
  Download,
  Calculator
} from 'lucide-react';
import Link from 'next/link';
import { Employee, LeaveRequest, Area, LEAVE_REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS, DAY_SHIFT_LABELS } from '../lib/types';
import { formatAvailableTime, formatHoursOfTotalDays, calculateTotalLicensesTaken } from '../lib/time-utils';

export default function AdminDashboard() {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const firstCardRef = useRef<HTMLDivElement | null>(null);
  const [maxGridHeight, setMaxGridHeight] = useState<number>();
  const [stats, setStats] = useState({
    totalEmployees: 0,
    pendingRequests: 0,
    approvedRequests: 0,
    rejectedRequests: 0
  });
  const [pendingRequests, setPendingRequests] = useState<LeaveRequest[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [isDownloadingLicenses, setIsDownloadingLicenses] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [selectedBonosMonth, setSelectedBonosMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [bonosHorariosFile, setBonosHorariosFile] = useState<File | null>(null);
  const [bonosTicketsFile, setBonosTicketsFile] = useState<File | null>(null);
  const [bonosFeriadosFile, setBonosFeriadosFile] = useState<File | null>(null);
  const [bonosRecibosFile, setBonosRecibosFile] = useState<File | null>(null);
  const [bonosLoadingStatus, setBonosLoadingStatus] = useState(false);
  const [bonosSubmitting, setBonosSubmitting] = useState(false);
  const [bonosError, setBonosError] = useState<string | null>(null);
  const [bonosSuccess, setBonosSuccess] = useState<string | null>(null);
  const [bonosStatus, setBonosStatus] = useState<{
    horarios: { loaded: boolean; fileName?: string; rows?: number; loadedAt?: string; loadedBy?: string };
    ticketsHoras: { loaded: boolean; fileName?: string; rows?: number; loadedAt?: string; loadedBy?: string };
    feriados: { loaded: boolean; fileName?: string; rows?: number; loadedAt?: string; loadedBy?: string };
    recibos: { loaded: boolean; fileName?: string; rows?: number; loadedAt?: string; loadedBy?: string };
  } | null>(null);
  const [selectedCalculoMonth, setSelectedCalculoMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [calculoLoading, setCalculoLoading] = useState(false);
  const [calculoSubmitting, setCalculoSubmitting] = useState(false);
  const [calculoError, setCalculoError] = useState<string | null>(null);
  const [calculoData, setCalculoData] = useState<{
    validation?: {
      canCalculate: boolean;
      missing: string[];
      recibosMesAnio: string;
      items: Array<{ key: string; label: string; loaded: boolean; rows: number; mesAnio?: string }>;
      existing: { exists: boolean; totalEmpleados?: number; totalBonos?: number; generadoAt?: string };
    };
    calculo?: {
      id: string;
      mesAnio: string;
      totalEmpleados: number;
      totalBonos: number;
      generadoAt: string;
      resumenPdfPath?: string | null;
      planillaExcelPath?: string | null;
      empleados: Array<{
        empleado: string;
        tipo: string;
        antiguedad: number;
        sueldoNeto: number;
        tapPres: number;
        tapTotal: number;
        tpeOk: number;
        tpeTotal: number;
        ieaOk: number;
        ieaTotal: number;
        tardanzas: number;
        sinMarca: number;
        kpiPct: number;
        bonoExperiencia: number;
        bonoKpi: number;
        bonoDesarrollo: number;
        bonoCumplimiento: number;
        totalBono: number;
        horasExtras: number;
        htmlPath?: string;
      }>;
    } | null;
  } | null>(null);

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

  // Measure first card height and row gap to fit exactly 2 rows without cutting
  useEffect(() => {
    const measure = () => {
      if (!gridRef.current || !firstCardRef.current) return;
      const cardH = firstCardRef.current.getBoundingClientRect().height;
      const styles = getComputedStyle(gridRef.current);
      const rowGap = parseFloat(styles.rowGap || '0') || 0;
      setMaxGridHeight(cardH * 2 + rowGap);
    };
    // wait for layout
    requestAnimationFrame(measure);
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [employees]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatRequestDetails = (request: LeaveRequest) => {
    if (request.type === 'HOURS') {
      const timeRange = request.startTime && request.endTime 
        ? ` • ${request.startTime}-${request.endTime}` 
        : '';
      return `${request.hours || 0} horas${timeRange}`;
    }
    
    if (request.type === 'PERSONAL' || request.type === 'REMOTE') {
      if (request.shift && DAY_SHIFT_LABELS[request.shift as keyof typeof DAY_SHIFT_LABELS]) {
        return DAY_SHIFT_LABELS[request.shift as keyof typeof DAY_SHIFT_LABELS];
      }
      return 'Sin especificar';
    }
    
    if (request.type === 'LICENSE') {
      return request.isHalfDay ? '0.5 días' : 'Días completos';
    }
    
    return '';
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'approved';
      case 'REJECTED': return 'rejected';
      default: return 'pending';
    }
  };

  const handleDownloadMonthlyLicenses = async () => {
    if (!selectedMonth) {
      setDownloadError('Debes seleccionar un mes y año.');
      return;
    }

    setDownloadError(null);
    setIsDownloadingLicenses(true);

    try {
      const response = await fetch(`/api/reports/licenses-month?month=${selectedMonth}`);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'No se pudo generar el archivo.');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `licencias_${selectedMonth}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al descargar.';
      setDownloadError(message);
    } finally {
      setIsDownloadingLicenses(false);
    }
  };

  const loadBonosStatus = async (month: string) => {
    if (!month) return;
    setBonosLoadingStatus(true);
    setBonosError(null);

    try {
      const res = await fetch(`/api/bonos/cargas/status?mes=${month}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo consultar el estado de cargas.');
      }
      setBonosStatus(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado consultando estado.';
      setBonosError(message);
      setBonosStatus(null);
    } finally {
      setBonosLoadingStatus(false);
    }
  };

  useEffect(() => {
    loadBonosStatus(selectedBonosMonth);
  }, [selectedBonosMonth]);

  const handleUploadBonosFiles = async () => {
    if (!selectedBonosMonth) {
      setBonosError('Debes seleccionar un mes y año.');
      return;
    }

    if (!bonosHorariosFile && !bonosTicketsFile && !bonosFeriadosFile && !bonosRecibosFile) {
      setBonosError('Debes seleccionar al menos un archivo.');
      return;
    }

    setBonosSubmitting(true);
    setBonosError(null);
    setBonosSuccess(null);

    try {
      const formData = new FormData();
      formData.append('mes_anio', selectedBonosMonth);
      if (bonosHorariosFile) formData.append('horarios_file', bonosHorariosFile);
      if (bonosTicketsFile) formData.append('tickets_file', bonosTicketsFile);
      if (bonosFeriadosFile) formData.append('feriados_file', bonosFeriadosFile);
      if (bonosRecibosFile) formData.append('recibos_file', bonosRecibosFile);

      const res = await fetch('/api/bonos/cargas', {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo guardar la carga.');
      }

      const mensajes: string[] = [];
      if (data.horarios?.replaced) mensajes.push(`Horarios: ${data.horarios.rows} filas`);
      if (data.ticketsHoras?.replaced) mensajes.push(`Tickets-Horas: ${data.ticketsHoras.rows} filas`);
      if (data.feriados?.replaced) mensajes.push(`Feriados: ${data.feriados.rows} filas`);
      if (data.recibos?.replaced) mensajes.push(`Recibos: ${data.recibos.rows} empleados`);
      setBonosSuccess(`Carga aplicada para ${selectedBonosMonth}. ${mensajes.join(' · ')}`);
      setBonosHorariosFile(null);
      setBonosTicketsFile(null);
      setBonosFeriadosFile(null);
      setBonosRecibosFile(null);
      await loadBonosStatus(selectedBonosMonth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al subir archivos.';
      setBonosError(message);
    } finally {
      setBonosSubmitting(false);
    }
  };

  const handleSyncTicketsApi = async () => {
    if (!selectedBonosMonth) {
      setBonosError('Debes seleccionar un mes y año.');
      return;
    }

    setBonosSubmitting(true);
    setBonosError(null);
    setBonosSuccess(null);

    try {
      const res = await fetch('/api/bonos/cargas/tickets-api', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes_anio: selectedBonosMonth })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'No se pudo sincronizar Tickets-Horas desde la API.');
      }

      setBonosSuccess(`Tickets-Horas sincronizado desde API para ${selectedBonosMonth}. ${data.ticketsHoras?.rows ?? 0} filas`);
      setBonosTicketsFile(null);
      await loadBonosStatus(selectedBonosMonth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado al sincronizar Tickets-Horas.';
      setBonosError(message);
    } finally {
      setBonosSubmitting(false);
    }
  };

  const renderUploadStatus = (
    label: string,
    info: { loaded: boolean; fileName?: string; rows?: number; loadedAt?: string; loadedBy?: string } | undefined
  ) => {
    if (!info?.loaded) {
      return (
        <div className="text-sm text-gray-600">
          <span className="font-medium">{label}:</span> Sin datos cargados
        </div>
      );
    }

    return (
      <div className="text-sm text-gray-700">
        <span className="font-medium">{label}:</span> {info.fileName} · {info.rows ?? 0} filas ·{' '}
        {info.loadedAt ? new Date(info.loadedAt).toLocaleString('es-AR') : '-'} · {info.loadedBy || '-'}
      </div>
    );
  };

  const formatMoney = (value: number) =>
    new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(value || 0);

  const formatPct = (value: number) => `${((value || 0) * 100).toFixed(2)}%`;

  const metricRatio = (value: number, total: number) => `${value || 0}/${total || 0}`;

  const calculoTotals = calculoData?.calculo?.empleados.reduce(
    (acc, row) => ({
      bonoExperiencia: acc.bonoExperiencia + row.bonoExperiencia,
      bonoKpi: acc.bonoKpi + row.bonoKpi,
      bonoDesarrollo: acc.bonoDesarrollo + row.bonoDesarrollo,
      bonoCumplimiento: acc.bonoCumplimiento + row.bonoCumplimiento,
      totalBono: acc.totalBono + row.totalBono
    }),
    { bonoExperiencia: 0, bonoKpi: 0, bonoDesarrollo: 0, bonoCumplimiento: 0, totalBono: 0 }
  );

  const loadCalculoStatus = async (month: string) => {
    if (!month) return;
    setCalculoLoading(true);
    setCalculoError(null);
    try {
      const res = await fetch(`/api/bonos/calcular?mes=${month}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo consultar el cálculo.');
      setCalculoData(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado consultando cálculo.';
      setCalculoError(message);
      setCalculoData(null);
    } finally {
      setCalculoLoading(false);
    }
  };

  useEffect(() => {
    loadCalculoStatus(selectedCalculoMonth);
  }, [selectedCalculoMonth]);

  const handleCalcularBonos = async (force = false) => {
    if (!selectedCalculoMonth) {
      setCalculoError('Debes seleccionar un mes y año.');
      return;
    }
    setCalculoSubmitting(true);
    setCalculoError(null);
    try {
      const res = await fetch('/api/bonos/calcular', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mes_anio: selectedCalculoMonth, force })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo calcular bonos.');
      setCalculoData({
        validation: {
          canCalculate: true,
          missing: [],
          recibosMesAnio: data.result.recibosMesAnio,
          items: [],
          existing: { exists: true, totalEmpleados: data.result.totalEmpleados, totalBonos: data.result.totalBonos }
        },
        calculo: data.calculo
      });
      await loadCalculoStatus(selectedCalculoMonth);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Error inesperado calculando bonos.';
      setCalculoError(message);
    } finally {
      setCalculoSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3"></div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <Users className="h-6 w-6 text-sgn-blue mx-auto mb-2" />
            <p className="text-xl font-bold text-sgn-dark">{stats.totalEmployees}</p>
            <p className="text-sm text-gray-600">Total Empleados</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <Clock className="h-6 w-6 text-yellow-600 mx-auto mb-2" />
            <p className="text-xl font-bold text-yellow-600">{stats.pendingRequests}</p>
            <p className="text-sm text-gray-600">Solicitudes Pendientes</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
            <p className="text-xl font-bold text-green-600">{stats.approvedRequests}</p>
            <p className="text-sm text-gray-600">Aprobadas</p>
          </CardContent>
        </Card>

        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <XCircle className="h-6 w-6 text-red-600 mx-auto mb-2" />
            <p className="text-xl font-bold text-red-600">{stats.rejectedRequests}</p>
            <p className="text-sm text-gray-600">Rechazadas</p>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
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
                      <p className="text-xs text-blue-600 font-medium">
                        {formatRequestDetails(request)}
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

        {/* Employee Cards */}
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
              <div
                ref={gridRef}
                className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-3 overflow-y-auto"
                style={maxGridHeight ? { maxHeight: `${Math.round(maxGridHeight)}px` } : undefined}
              >
                {employees.slice(0, 12).map((employee, i) => {
                  const totalLicensesTaken = calculateTotalLicensesTaken(employee);
                  
                  return (
                    <div ref={i === 0 ? firstCardRef : undefined}>
                      <Card key={employee.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-3">
                        <div className="mb-2">
                          <h4 className="font-semibold text-xs text-sgn-dark leading-tight">
                            {employee.firstName} {employee.lastName}
                          </h4>
                          <p className="text-xs text-gray-600 truncate">
                            {employee.position}
                          </p>
                          <p className="text-xs text-gray-500 truncate">
                            {employee.area?.name || 'Sin área'}
                          </p>
                          <Badge variant={employee.user?.role === 'ADMIN' ? 'secondary' : 'default'} className="text-xs mt-1">
                            {employee.user?.role === 'ADMIN' ? 'Admin' : 'Empleado'}
                          </Badge>
                        </div>
                        
                        <div className="space-y-1 text-xs">
                          <div className="text-sgn-dark font-medium">
                            Licencias: {totalLicensesTaken} días
                          </div>
                          <div className="text-gray-600">
                            Vacaciones: {employee.vacationDays || 0} de {employee.totalVacationDays} días
                          </div>
                          <div className="text-gray-600">
                            Personales: {formatHoursOfTotalDays(employee.personalHours || 0, employee.totalPersonalHours || 0)}
                          </div>
                          <div className="text-gray-600">
                            Remotos: {formatHoursOfTotalDays(employee.remoteHours || 0, employee.totalRemoteHours || 0)}
                          </div>
                          <div className="text-gray-600">
                            Horas: {(employee.availableHours || 0)} de {(employee.totalAvailableHours || 0)} horas
                          </div>
                        </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
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
                Gestionar Empleados
              </Button>
            </Link>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full h-16 flex-col gap-2">
                  <Download className="h-6 w-6" />
                  Licencias del Mes
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Descargar Licencias del Mes</DialogTitle>
                  <DialogDescription>
                    Selecciona mes y año para exportar las licencias en formato Excel (CSV).
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-2">
                  <label htmlFor="month-year" className="text-sm font-medium text-sgn-dark">
                    Mes - Año
                  </label>
                  <Input
                    id="month-year"
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    max={new Date().toISOString().slice(0, 7)}
                  />
                  {downloadError ? (
                    <p className="text-sm text-red-600">{downloadError}</p>
                  ) : null}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    onClick={handleDownloadMonthlyLicenses}
                    disabled={isDownloadingLicenses || !selectedMonth}
                  >
                    {isDownloadingLicenses ? 'Generando archivo...' : 'Descargar Excel'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full h-16 flex-col gap-2">
                  <Calculator className="h-6 w-6" />
                  Calcular Bonos
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-5xl max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>Calcular Bonos del Mes</DialogTitle>
                  <DialogDescription>
                    Selecciona el período, valida las cargas requeridas y genera el cálculo para revisión.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label htmlFor="bonos-calculo-month" className="text-sm font-medium text-sgn-dark">
                      Mes - Año
                    </label>
                    <Input
                      id="bonos-calculo-month"
                      type="month"
                      value={selectedCalculoMonth}
                      onChange={(e) => setSelectedCalculoMonth(e.target.value)}
                    />
                  </div>

                  <div className="rounded-md border border-gray-200 p-3 space-y-2 bg-gray-50">
                    <p className="text-sm font-medium text-sgn-dark">Validación de datos</p>
                    {calculoLoading ? (
                      <p className="text-sm text-gray-600">Consultando datos...</p>
                    ) : calculoData?.validation ? (
                      <>
                        {calculoData.validation.items.map((item) => (
                          <div key={item.key} className="text-sm text-gray-700">
                            <span className="font-medium">{item.label}:</span>{' '}
                            {item.loaded ? `${item.rows} filas (${item.mesAnio})` : `Falta (${item.mesAnio})`}
                          </div>
                        ))}
                        {calculoData.validation.existing.exists ? (
                          <p className="text-sm text-amber-700">
                            Ya existe cálculo: {calculoData.validation.existing.totalEmpleados} empleados ·{' '}
                            {formatMoney(calculoData.validation.existing.totalBonos || 0)}
                          </p>
                        ) : null}
                        {!calculoData.validation.canCalculate ? (
                          <p className="text-sm text-red-600">
                            Faltan: {calculoData.validation.missing.join(', ')}
                          </p>
                        ) : null}
                      </>
                    ) : (
                      <p className="text-sm text-gray-600">Sin datos consultados</p>
                    )}
                  </div>

                  {calculoData?.calculo ? (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-medium text-sgn-dark">
                          Resultado: {calculoData.calculo.totalEmpleados} empleados · {formatMoney(calculoData.calculo.totalBonos)}
                        </p>
                      </div>
                      <div className="overflow-x-auto rounded-md border">
                        <table className="w-full text-xs table-fixed">
                          <thead className="bg-sgn-blue text-white">
                            <tr>
                              <th className="p-2 text-left w-[18%]">Empleado</th>
                              <th className="p-2 text-center w-[10%]">Antigüed.</th>
                              <th className="p-2 text-right">Sueldo</th>
                              <th className="p-2 text-right">Bono Exp.</th>
                              <th className="p-2 text-right">Bono Compr.</th>
                              <th className="p-2 text-right">Horas Extras</th>
                              <th className="p-2 text-right">Bono Cumpl.</th>
                              <th className="p-2 text-right">TOTAL BONO</th>
                            </tr>
                          </thead>
                          <tbody>
                            {calculoData.calculo.empleados.map((row) => (
                              <tr key={row.empleado} className="border-t odd:bg-white even:bg-gray-50">
                                <td className="p-2">{row.empleado}</td>
                                <td className="p-2 text-center">{row.antiguedad} años</td>
                                <td className="p-2 text-right">{formatMoney(row.sueldoNeto)}</td>
                                <td className="p-2 text-right">{formatMoney(row.bonoExperiencia)}</td>
                                <td className="p-2 text-right">{formatMoney(row.bonoKpi)}</td>
                                <td className="p-2 text-right">{formatMoney(row.bonoDesarrollo)}</td>
                                <td className="p-2 text-right">{formatMoney(row.bonoCumplimiento)}</td>
                                <td className="p-2 text-right font-medium">{formatMoney(row.totalBono)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot className="bg-blue-50 font-semibold">
                            <tr className="border-t">
                              <td className="p-2">TOTAL</td>
                              <td className="p-2" />
                              <td className="p-2" />
                              <td className="p-2 text-right">{formatMoney(calculoTotals?.bonoExperiencia || 0)}</td>
                              <td className="p-2 text-right">{formatMoney(calculoTotals?.bonoKpi || 0)}</td>
                              <td className="p-2 text-right">{formatMoney(calculoTotals?.bonoDesarrollo || 0)}</td>
                              <td className="p-2 text-right">{formatMoney(calculoTotals?.bonoCumplimiento || 0)}</td>
                              <td className="p-2 text-right">{formatMoney(calculoTotals?.totalBono || 0)}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                        <p className="text-sm font-medium text-sgn-dark mb-2">Archivos generados</p>
                        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-2">
                          {calculoData.calculo.resumenPdfPath ? (
                            <a href={calculoData.calculo.resumenPdfPath} target="_blank" rel="noopener noreferrer">
                              <Button type="button" size="sm" variant="outline" className="w-full">HTML Resumen</Button>
                            </a>
                          ) : null}
                          {calculoData.calculo.planillaExcelPath ? (
                            <a href={calculoData.calculo.planillaExcelPath} target="_blank" rel="noopener noreferrer">
                              <Button type="button" size="sm" variant="outline" className="w-full">HTML Contadora</Button>
                            </a>
                          ) : null}
                          {calculoData.calculo.empleados
                            .filter((row) => row.htmlPath)
                            .map((row) => (
                              <a key={row.empleado} href={row.htmlPath} target="_blank" rel="noopener noreferrer">
                                <Button type="button" size="sm" variant="outline" className="w-full truncate">HTML {row.empleado}</Button>
                              </a>
                            ))}
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {calculoError ? <p className="text-sm text-red-600">{calculoError}</p> : null}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant={calculoData?.validation?.existing.exists ? 'outline' : 'default'}
                    onClick={() => handleCalcularBonos(Boolean(calculoData?.validation?.existing.exists))}
                    disabled={calculoSubmitting || !calculoData?.validation?.canCalculate}
                  >
                    {calculoSubmitting
                      ? 'Calculando...'
                      : calculoData?.validation?.existing.exists
                        ? 'Recalcular'
                        : 'Calcular Bonos'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>

            <Dialog>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full h-16 flex-col gap-2">
                  <FileText className="h-6 w-6" />
                  Carga Archivos para Bonos
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Carga de Archivos de Bonos</DialogTitle>
                  <DialogDescription>
                    Selecciona mes-año, carga Horarios, Calendario Feriados y Recibos Sueldo. Tickets-Horas se sincroniza desde SGN Tickets.
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-3">
                  <div className="space-y-2">
                    <label htmlFor="bonos-month-year" className="text-sm font-medium text-sgn-dark">
                      Mes - Año
                    </label>
                    <Input
                      id="bonos-month-year"
                      type="month"
                      value={selectedBonosMonth}
                      onChange={(e) => setSelectedBonosMonth(e.target.value)}
                    />
                  </div>

                  <div className="rounded-md border border-gray-200 p-3 space-y-2 bg-gray-50">
                    <p className="text-sm font-medium text-sgn-dark">Estado del período</p>
                    {bonosLoadingStatus ? (
                      <p className="text-sm text-gray-600">Consultando estado...</p>
                    ) : (
                      <>
                        {renderUploadStatus('Horarios', bonosStatus?.horarios)}
                        {renderUploadStatus('Tickets-Horas', bonosStatus?.ticketsHoras)}
                        {renderUploadStatus('Calendario Feriados', bonosStatus?.feriados)}
                        {renderUploadStatus('Recibos PDF', bonosStatus?.recibos)}
                      </>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="bonos-horarios-file" className="text-sm font-medium text-sgn-dark">
                      Horarios (.xlsx o .csv)
                    </label>
                    <Input
                      id="bonos-horarios-file"
                      type="file"
                      accept=".xlsx,.csv,text/csv"
                      onChange={(e) => setBonosHorariosFile(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  <div className="rounded-md border border-gray-200 p-3 space-y-2">
                    <p className="text-sm font-medium text-sgn-dark">Tickets-Horas</p>
                    <p className="text-xs text-gray-600">
                      Sincroniza el resumen desde SGN Tickets para reemplazar la importación manual del CSV.
                    </p>
                    <Button type="button" variant="outline" onClick={handleSyncTicketsApi} disabled={bonosSubmitting}>
                      {bonosSubmitting ? 'Sincronizando...' : 'Sincronizar desde API'}
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="bonos-feriados-file" className="text-sm font-medium text-sgn-dark">
                      Calendario Feriados (.csv)
                    </label>
                    <Input
                      id="bonos-feriados-file"
                      type="file"
                      accept=".csv,text/csv"
                      onChange={(e) => setBonosFeriadosFile(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="bonos-recibos-file" className="text-sm font-medium text-sgn-dark">
                      Recibos Sueldo (.pdf)
                    </label>
                    <Input
                      id="bonos-recibos-file"
                      type="file"
                      accept=".pdf,application/pdf"
                      onChange={(e) => setBonosRecibosFile(e.target.files?.[0] ?? null)}
                    />
                  </div>

                  {bonosError ? <p className="text-sm text-red-600">{bonosError}</p> : null}
                  {bonosSuccess ? <p className="text-sm text-green-700">{bonosSuccess}</p> : null}
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    onClick={handleUploadBonosFiles}
                    disabled={bonosSubmitting || (!bonosHorariosFile && !bonosFeriadosFile && !bonosRecibosFile)}
                  >
                    {bonosSubmitting ? 'Guardando carga...' : 'Guardar Carga'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

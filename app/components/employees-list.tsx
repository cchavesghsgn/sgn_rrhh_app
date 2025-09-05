
'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  Users,
  Plus,
  Mail,
  Phone,
  Building2,
  Calendar,
  Search,
  Edit,
  Trash2,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import { Input } from './ui/input';
import { Employee } from '../lib/types';
import { formatAvailableTime, formatYearsOfService } from '../lib/time-utils';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from './ui/alert-dialog';
import toast from 'react-hot-toast';

export default function EmployeesList() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [filteredEmployees, setFilteredEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await fetch('/api/employees');
        if (response.ok) {
          const data = await response.json();
          setEmployees(data);
          setFilteredEmployees(data);
        }
      } catch (error) {
        console.error('Error fetching employees:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchEmployees();
  }, []);

  useEffect(() => {
    if (searchTerm) {
      const filtered = employees.filter(employee =>
        `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.dni.includes(searchTerm) ||
        employee.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
        employee.area?.name?.toLowerCase().includes(searchTerm.toLowerCase())
      );
      setFilteredEmployees(filtered);
    } else {
      setFilteredEmployees(employees);
    }
  }, [searchTerm, employees]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const handleDeleteEmployee = async (employeeId: string, employeeName: string) => {
    setDeleteLoading(employeeId);
    
    try {
      const response = await fetch(`/api/employees/${employeeId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || `Empleado ${employeeName} eliminado exitosamente`);
        // Refetch employees to update the list
        const newEmployees = employees.filter(emp => emp.id !== employeeId);
        setEmployees(newEmployees);
        setFilteredEmployees(newEmployees.filter(employee =>
          `${employee.firstName} ${employee.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
          employee.dni.includes(searchTerm) ||
          employee.position.toLowerCase().includes(searchTerm.toLowerCase()) ||
          employee.area?.name?.toLowerCase().includes(searchTerm.toLowerCase())
        ));
      } else {
        const errorData = await response.json();
        toast.error(errorData.error || 'Error al eliminar el empleado');
      }
    } catch (error) {
      console.error('Error deleting employee:', error);
      toast.error('Error al eliminar el empleado');
    } finally {
      setDeleteLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div className="flex items-center gap-4">
          <p className="text-gray-600">
            Total: <span className="font-semibold">{filteredEmployees.length}</span> empleados
          </p>
        </div>
        
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar empleados..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Link href="/admin/employees/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Empleado
            </Button>
          </Link>
        </div>
      </div>

      {/* Employees Grid */}
      {filteredEmployees.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredEmployees.map((employee) => (
            <Card key={employee.id} className="sgn-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="font-semibold text-lg text-sgn-dark">
                      {employee.firstName} {employee.lastName}
                    </h3>
                    <p className="text-sm text-gray-600">{employee.position}</p>
                    <Badge variant={employee.user?.role === 'ADMIN' ? 'secondary' : 'default'} className="mt-1">
                      {employee.user?.role === 'ADMIN' ? 'Administrador' : 'Empleado'}
                    </Badge>
                  </div>
                </div>

                <div className="space-y-3 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Mail className="h-4 w-4" />
                    <span>{employee.user?.email}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <Phone className="h-4 w-4" />
                    <span>{employee.phone || 'No especificado'}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <Building2 className="h-4 w-4" />
                    <span>{employee.area?.name}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Ingreso: {formatDate(employee.hireDate.toString())}</span>
                  </div>

                  <div className="flex items-center gap-2 text-gray-600">
                    <div className="h-4 w-4" /> {/* Espaciador para alinear con otros campos */}
                    <span className="text-sm font-medium text-blue-700">
                      Antigüedad: {formatYearsOfService(employee.hireDate)}
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <span className="font-medium">Vacaciones:</span> {employee.vacationDays}
                    </div>
                    <div>
                      <span className="font-medium">Personales:</span> {formatAvailableTime(employee.totalPersonalHours || 0)}
                    </div>
                    <div>
                      <span className="font-medium">Remotos:</span> {formatAvailableTime(employee.totalRemoteHours || 0)}
                    </div>
                    <div>
                      <span className="font-medium">Horas:</span> {employee.totalAvailableHours || 0}
                    </div>
                  </div>
                </div>

                <div className="mt-4 flex gap-2">
                  <Link href={`/admin/employees/${employee.id}/edit`} className="flex-1">
                    <Button size="sm" variant="outline" className="w-full">
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  </Link>
                  
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1 text-red-600 hover:text-red-700 hover:border-red-300"
                        disabled={deleteLoading === employee.id}
                      >
                        {deleteLoading === employee.id ? (
                          <>
                            <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-transparent border-t-current" />
                            Eliminando...
                          </>
                        ) : (
                          <>
                            <Trash2 className="h-4 w-4 mr-2" />
                            Eliminar
                          </>
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle className="flex items-center gap-2">
                          <AlertTriangle className="h-5 w-5 text-red-500" />
                          Confirmar Eliminación
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                          ¿Estás seguro que deseas eliminar al empleado{' '}
                          <span className="font-semibold">
                            {employee.firstName} {employee.lastName}
                          </span>
                          ?
                          <p className="mt-2 text-gray-600">Esta acción no se puede deshacer.</p>
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDeleteEmployee(employee.id, `${employee.firstName} ${employee.lastName}`)}
                          className="bg-red-600 hover:bg-red-700 focus:ring-red-600"
                        >
                          Eliminar Empleado
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="sgn-card">
          <CardContent className="p-12 text-center">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {searchTerm ? 'No se encontraron empleados' : 'No hay empleados registrados'}
            </h3>
            <p className="text-gray-600 mb-6">
              {searchTerm 
                ? 'Intenta con otros términos de búsqueda'
                : 'Agrega el primer empleado para comenzar'
              }
            </p>
            {!searchTerm && (
              <Link href="/admin/employees/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Empleado
                </Button>
              </Link>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

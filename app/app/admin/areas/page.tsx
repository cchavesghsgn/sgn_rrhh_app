
'use client';

import { useState, useEffect } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Header from '../../../components/header';
import { Button } from '../../../components/ui/button';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '../../../components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '../../../components/ui/alert-dialog';
import { Textarea } from '../../../components/ui/textarea';
import { Badge } from '../../../components/ui/badge';
import { PlusIcon, PencilIcon, TrashIcon, UsersIcon } from 'lucide-react';
import { useToast } from '../../../components/ui/use-toast';

interface Area {
  id: string;
  name: string;
  description: string | null;
  employees: {
    id: string;
    firstName: string;
    lastName: string;
    position?: string;
  }[];
  createdAt: string;
}

export default function AdminAreasPage() {
  const { data: session, status } = useSession() || {};
  const router = useRouter();
  const { toast } = useToast();
  
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewAreaDialog, setShowNewAreaDialog] = useState(false);
  const [editingArea, setEditingArea] = useState<Area | null>(null);
  const [newAreaData, setNewAreaData] = useState({ name: '', description: '' });

  // Auth check
  useEffect(() => {
    if (status === 'loading') return;
    if (!session) {
      router.push('/login');
      return;
    }
    if (session.user.role !== 'ADMIN') {
      router.push('/dashboard');
      return;
    }
  }, [session, status, router]);

  // Load areas
  useEffect(() => {
    if (session?.user) {
      loadAreas();
    }
  }, [session]);

  const loadAreas = async () => {
    try {
      const response = await fetch('/api/areas');
      if (response.ok) {
        const data = await response.json();
        setAreas(data);
      } else {
        toast({
          title: 'Error',
          description: 'No se pudieron cargar las áreas',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Load areas error:', error);
      toast({
        title: 'Error',
        description: 'Error de conexión',
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateArea = async () => {
    if (!newAreaData.name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre del área es requerido',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch('/api/areas', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(newAreaData),
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Área creada correctamente'
        });
        setNewAreaData({ name: '', description: '' });
        setShowNewAreaDialog(false);
        loadAreas();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Error al crear área',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Create area error:', error);
      toast({
        title: 'Error',
        description: 'Error de conexión',
        variant: 'destructive'
      });
    }
  };

  const handleEditArea = async () => {
    if (!editingArea || !editingArea.name.trim()) {
      toast({
        title: 'Error',
        description: 'El nombre del área es requerido',
        variant: 'destructive'
      });
      return;
    }

    try {
      const response = await fetch(`/api/areas/${editingArea.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editingArea.name,
          description: editingArea.description
        }),
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Área actualizada correctamente'
        });
        setEditingArea(null);
        loadAreas();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Error al actualizar área',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Update area error:', error);
      toast({
        title: 'Error',
        description: 'Error de conexión',
        variant: 'destructive'
      });
    }
  };

  const handleDeleteArea = async (areaId: string) => {
    try {
      const response = await fetch(`/api/areas/${areaId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast({
          title: 'Éxito',
          description: 'Área eliminada correctamente'
        });
        loadAreas();
      } else {
        const data = await response.json();
        toast({
          title: 'Error',
          description: data.error || 'Error al eliminar área',
          variant: 'destructive'
        });
      }
    } catch (error) {
      console.error('Delete area error:', error);
      toast({
        title: 'Error',
        description: 'Error de conexión',
        variant: 'destructive'
      });
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-sgn-red mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando...</p>
        </div>
      </div>
    );
  }

  if (!session || session.user.role !== 'ADMIN') {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      <main className="container max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-sgn-dark mb-2">
              Gestión de Áreas
            </h1>
            <p className="text-gray-600">
              Administra las áreas de la empresa y sus empleados
            </p>
          </div>
          
          <Dialog open={showNewAreaDialog} onOpenChange={setShowNewAreaDialog}>
            <DialogTrigger asChild>
              <Button className="bg-sgn-red hover:bg-sgn-red/90 text-white">
                <PlusIcon className="h-4 w-4 mr-2" />
                Nueva Área
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Crear Nueva Área</DialogTitle>
                <DialogDescription>
                  Ingresa los datos del área a crear
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Nombre del Área *</Label>
                  <Input
                    id="name"
                    value={newAreaData.name}
                    onChange={(e) => setNewAreaData({...newAreaData, name: e.target.value})}
                    placeholder="Ej: Recursos Humanos"
                  />
                </div>
                <div>
                  <Label htmlFor="description">Descripción</Label>
                  <Textarea
                    id="description"
                    value={newAreaData.description}
                    onChange={(e) => setNewAreaData({...newAreaData, description: e.target.value})}
                    placeholder="Descripción del área..."
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowNewAreaDialog(false)}>
                  Cancelar
                </Button>
                <Button 
                  onClick={handleCreateArea}
                  className="bg-sgn-red hover:bg-sgn-red/90"
                >
                  Crear Área
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {areas.map((area) => (
            <Card key={area.id} className="hover:shadow-lg transition-shadow">
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-sgn-dark">{area.name}</CardTitle>
                    {area.description && (
                      <CardDescription className="mt-2">
                        {area.description}
                      </CardDescription>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    <Dialog 
                      open={editingArea?.id === area.id} 
                      onOpenChange={(open) => {
                        if (open) {
                          setEditingArea(area);
                        } else {
                          setEditingArea(null);
                        }
                      }}
                    >
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm">
                          <PencilIcon className="h-4 w-4" />
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Editar Área</DialogTitle>
                          <DialogDescription>
                            Modifica los datos del área
                          </DialogDescription>
                        </DialogHeader>
                        {editingArea && (
                          <div className="space-y-4">
                            <div>
                              <Label htmlFor="edit-name">Nombre del Área *</Label>
                              <Input
                                id="edit-name"
                                value={editingArea.name}
                                onChange={(e) => setEditingArea({...editingArea, name: e.target.value})}
                              />
                            </div>
                            <div>
                              <Label htmlFor="edit-description">Descripción</Label>
                              <Textarea
                                id="edit-description"
                                value={editingArea.description || ''}
                                onChange={(e) => setEditingArea({...editingArea, description: e.target.value})}
                                rows={3}
                              />
                            </div>
                          </div>
                        )}
                        <DialogFooter>
                          <Button variant="outline" onClick={() => setEditingArea(null)}>
                            Cancelar
                          </Button>
                          <Button 
                            onClick={handleEditArea}
                            className="bg-sgn-red hover:bg-sgn-red/90"
                          >
                            Guardar Cambios
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                    
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={area.employees.length > 0}
                        >
                          <TrashIcon className="h-4 w-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>¿Eliminar área?</AlertDialogTitle>
                          <AlertDialogDescription>
                            Esta acción no se puede deshacer. El área "{area.name}" será eliminada permanentemente.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction 
                            onClick={() => handleDeleteArea(area.id)}
                            className="bg-red-600 hover:bg-red-700"
                          >
                            Eliminar
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div className="flex items-center text-sm text-gray-600">
                    <UsersIcon className="h-4 w-4 mr-1" />
                    {area.employees.length} empleado{area.employees.length !== 1 ? 's' : ''}
                  </div>
                  <Badge variant={area.employees.length > 0 ? 'default' : 'secondary'}>
                    {area.employees.length > 0 ? 'Activa' : 'Vacía'}
                  </Badge>
                </div>
                
                {area.employees.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-gray-700 mb-2">Empleados:</p>
                    <div className="space-y-1">
                      {area.employees.slice(0, 3).map((employee) => (
                        <div key={employee.id} className="text-sm text-gray-600">
                          {employee.firstName} {employee.lastName}
                          {employee.position && (
                            <span className="text-gray-400"> - {employee.position}</span>
                          )}
                        </div>
                      ))}
                      {area.employees.length > 3 && (
                        <p className="text-sm text-gray-500 italic">
                          y {area.employees.length - 3} más...
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {areas.length === 0 && !loading && (
          <Card className="text-center py-12">
            <CardContent>
              <UsersIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No hay áreas registradas
              </h3>
              <p className="text-gray-500 mb-4">
                Crea tu primera área para comenzar a organizar los empleados
              </p>
              <Button 
                onClick={() => setShowNewAreaDialog(true)}
                className="bg-sgn-red hover:bg-sgn-red/90 text-white"
              >
                <PlusIcon className="h-4 w-4 mr-2" />
                Crear Primera Área
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

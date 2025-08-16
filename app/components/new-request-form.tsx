
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { 
  FileText,
  Calendar,
  Clock,
  Send,
  ArrowLeft
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { LEAVE_REQUEST_TYPE_LABELS, LeaveRequestType } from '../lib/types';

export default function NewRequestForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [availableDays, setAvailableDays] = useState({
    personal: 0,
    remote: 0,
    hours: 0
  });

  const [formData, setFormData] = useState({
    type: '',
    startDate: '',
    endDate: '',
    isHalfDay: false,
    hours: '',
    reason: ''
  });

  useEffect(() => {
    const fetchAvailableDays = async () => {
      try {
        const response = await fetch('/api/employees/me');
        if (response.ok) {
          const employee = await response.json();
          setAvailableDays({
            personal: employee.personalDays,
            remote: employee.remoteDays,
            hours: employee.availableHours
          });
        }
      } catch (error) {
        console.error('Error fetching available days:', error);
      }
    };

    fetchAvailableDays();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validation
      if (!formData.type || !formData.startDate || !formData.endDate || !formData.reason) {
        toast.error('Por favor completa todos los campos requeridos');
        return;
      }

      if (formData.type === 'HOURS' && !formData.hours) {
        toast.error('Por favor especifica las horas para este tipo de solicitud');
        return;
      }

      const payload = {
        ...formData,
        hours: formData.hours ? parseInt(formData.hours) : null
      };

      const response = await fetch('/api/leave-requests', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok) {
        toast.success('Solicitud enviada exitosamente');
        router.push('/requests');
      } else {
        toast.error(result.error || 'Error al crear la solicitud');
      }
    } catch (error) {
      console.error('Error submitting request:', error);
      toast.error('Error al enviar la solicitud');
    } finally {
      setLoading(false);
    }
  };

  const calculateDaysNeeded = () => {
    if (!formData.startDate || !formData.endDate) return 0;
    
    const start = new Date(formData.startDate);
    const end = new Date(formData.endDate);
    const diffTime = end.getTime() - start.getTime();
    let days = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (formData.isHalfDay && days === 1) {
      days = 0.5;
    }
    
    return days;
  };

  const getAvailableForType = () => {
    switch (formData.type) {
      case 'PERSONAL': return availableDays.personal;
      case 'REMOTE': return availableDays.remote;
      case 'HOURS': return availableDays.hours;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      <Card className="sgn-card">
        <CardHeader>
          <div className="flex items-center gap-3">
            <Link href="/requests">
              <Button variant="outline" size="sm">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-sgn-blue" />
              Nueva Solicitud de Permiso
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Type Selection */}
              <div className="space-y-2">
                <Label htmlFor="type">Tipo de Permiso *</Label>
                <Select 
                  value={formData.type || "none"} 
                  onValueChange={(value) => setFormData({ ...formData, type: value === "none" ? "" : value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecciona el tipo de permiso" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Seleccionar tipo</SelectItem>
                    <SelectItem value={LeaveRequestType.LICENSE}>
                      {LEAVE_REQUEST_TYPE_LABELS[LeaveRequestType.LICENSE]} (Sin límite)
                    </SelectItem>
                    <SelectItem value={LeaveRequestType.PERSONAL}>
                      {LEAVE_REQUEST_TYPE_LABELS[LeaveRequestType.PERSONAL]} (Disponibles: {availableDays.personal})
                    </SelectItem>
                    <SelectItem value={LeaveRequestType.REMOTE}>
                      {LEAVE_REQUEST_TYPE_LABELS[LeaveRequestType.REMOTE]} (Disponibles: {availableDays.remote})
                    </SelectItem>
                    <SelectItem value={LeaveRequestType.HOURS}>
                      {LEAVE_REQUEST_TYPE_LABELS[LeaveRequestType.HOURS]} (Disponibles: {availableDays.hours}h)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {getAvailableForType() !== null && formData.type !== 'LICENSE' && (
                  <p className="text-xs text-gray-600">
                    Tienes {getAvailableForType()} {formData.type === 'HOURS' ? 'horas' : 'días'} disponibles
                  </p>
                )}
              </div>

              {/* Hours (only for HOURS type) */}
              {formData.type === 'HOURS' && (
                <div className="space-y-2">
                  <Label htmlFor="hours">Cantidad de Horas *</Label>
                  <div className="relative">
                    <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <Input
                      id="hours"
                      type="number"
                      min="1"
                      max={availableDays.hours}
                      value={formData.hours}
                      onChange={(e) => setFormData({ ...formData, hours: e.target.value })}
                      className="pl-10"
                      placeholder="Ej: 4"
                    />
                  </div>
                </div>
              )}
            </div>

            {formData.type !== 'HOURS' && (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Start Date */}
                  <div className="space-y-2">
                    <Label htmlFor="startDate">Fecha de Inicio *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="startDate"
                        type="date"
                        value={formData.startDate}
                        onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* End Date */}
                  <div className="space-y-2">
                    <Label htmlFor="endDate">Fecha de Fin *</Label>
                    <div className="relative">
                      <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="endDate"
                        type="date"
                        value={formData.endDate}
                        onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>

                {/* Half Day Option */}
                {calculateDaysNeeded() === 1 && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="isHalfDay"
                      checked={formData.isHalfDay}
                      onChange={(e) => setFormData({ ...formData, isHalfDay: e.target.checked })}
                      className="rounded border-gray-300 text-sgn-blue focus:ring-sgn-blue"
                    />
                    <Label htmlFor="isHalfDay" className="text-sm">
                      Es medio día
                    </Label>
                  </div>
                )}

                {/* Days calculation */}
                {formData.startDate && formData.endDate && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Días solicitados: {calculateDaysNeeded()} día{calculateDaysNeeded() > 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Reason */}
            <div className="space-y-2">
              <Label htmlFor="reason">Motivo de la Solicitud *</Label>
              <textarea
                id="reason"
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                className="w-full min-h-[100px] px-3 py-2 border border-input rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Describe el motivo de tu solicitud..."
              />
            </div>

            {/* Submit Button */}
            <div className="flex gap-4">
              <Link href="/requests">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
              <Button type="submit" disabled={loading} className="flex-1">
                {loading ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Enviando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Send className="h-4 w-4" />
                    Enviar Solicitud
                  </div>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

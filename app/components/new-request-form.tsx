
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
import { LEAVE_REQUEST_TYPE_LABELS, LeaveRequestType, DayShift, DAY_SHIFT_LABELS } from '../lib/types';

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
    startTime: '',
    endTime: '',
    shift: '',
    reason: ''
  });

  // Calculate hours automatically based on start and end time
  const calculateHours = (startTime: string, endTime: string): number => {
    if (!startTime || !endTime) return 0;
    
    const start = new Date(`2000-01-01T${startTime}`);
    const end = new Date(`2000-01-01T${endTime}`);
    
    if (end <= start) return 0;
    
    const diffMs = end.getTime() - start.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);
    
    return Math.round(diffHours * 2) / 2; // Round to nearest 0.5 hour
  };

  // Update hours automatically when start/end time changes
  useEffect(() => {
    if (formData.type === 'HOURS' && formData.startTime && formData.endTime) {
      const calculatedHours = calculateHours(formData.startTime, formData.endTime);
      setFormData(prev => ({ ...prev, hours: calculatedHours.toString() }));
    }
  }, [formData.startTime, formData.endTime, formData.type]);

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
      if (!formData.type || !formData.reason) {
        toast.error('Por favor completa todos los campos requeridos');
        return;
      }

      // Validation based on request type
      if (formData.type === 'HOURS') {
        if (!formData.startDate || !formData.startTime || !formData.endTime) {
          toast.error('Para pedido de horas debes completar día, hora de inicio y hora de fin');
          return;
        }
        const calculatedHours = calculateHours(formData.startTime, formData.endTime);
        if (calculatedHours <= 0) {
          toast.error('La hora de fin debe ser posterior a la hora de inicio');
          return;
        }
        if (calculatedHours > availableDays.hours) {
          toast.error(`No puedes solicitar más de ${availableDays.hours} horas disponibles`);
          return;
        }
      } else if (formData.type === 'PERSONAL' || formData.type === 'REMOTE') {
        if (!formData.startDate || !formData.shift) {
          toast.error('Para días personales/remotos debes completar día y turno');
          return;
        }
      } else if (formData.type === 'LICENSE') {
        if (!formData.startDate || !formData.endDate) {
          toast.error('Para licencias debes completar fecha de inicio y fin');
          return;
        }
      }

      const payload = {
        ...formData,
        hours: formData.hours ? parseInt(formData.hours) : null,
        shift: formData.shift || null,
        startTime: formData.startTime || null,
        endTime: formData.endTime || null,
        // For non-vacation requests, set endDate same as startDate if not provided
        endDate: formData.endDate || formData.startDate
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

              {/* Hours calculation display */}
              {formData.type === 'HOURS' && formData.startTime && formData.endTime && (
                <div className="space-y-2">
                  <Label>Horas Calculadas</Label>
                  <div className="p-3 bg-blue-50 rounded-md border border-blue-200">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-blue-600" />
                      <span className="text-sm font-medium text-blue-800">
                        {calculateHours(formData.startTime, formData.endTime)} horas
                      </span>
                    </div>
                    <p className="text-xs text-blue-600 mt-1">
                      Calculado automáticamente desde {formData.startTime} hasta {formData.endTime}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Date fields based on type */}
            {formData.type === 'LICENSE' && (
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

                {/* Days calculation for LICENSE */}
                {formData.startDate && formData.endDate && (
                  <div className="p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-800">
                      Días solicitados: {calculateDaysNeeded()} día{calculateDaysNeeded() > 1 ? 's' : ''}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Personal/Remote day fields */}
            {(formData.type === 'PERSONAL' || formData.type === 'REMOTE') && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Date */}
                <div className="space-y-2">
                  <Label htmlFor="startDate">Día *</Label>
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

                {/* Shift */}
                <div className="space-y-2">
                  <Label htmlFor="shift">Turno *</Label>
                  <Select 
                    value={formData.shift || "none"} 
                    onValueChange={(value) => setFormData({ ...formData, shift: value === "none" ? "" : value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecciona el turno" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Seleccionar turno</SelectItem>
                      <SelectItem value={DayShift.MORNING}>
                        {DAY_SHIFT_LABELS[DayShift.MORNING]}
                      </SelectItem>
                      <SelectItem value={DayShift.AFTERNOON}>
                        {DAY_SHIFT_LABELS[DayShift.AFTERNOON]}
                      </SelectItem>
                      <SelectItem value={DayShift.FULL_DAY}>
                        {DAY_SHIFT_LABELS[DayShift.FULL_DAY]}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* Hours specific fields */}
            {formData.type === 'HOURS' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="startDate">Día *</Label>
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

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Start Time */}
                  <div className="space-y-2">
                    <Label htmlFor="startTime">Hora de Inicio *</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="startTime"
                        type="time"
                        value={formData.startTime}
                        onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>

                  {/* End Time */}
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Hora de Fin *</Label>
                    <div className="relative">
                      <Clock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        id="endTime"
                        type="time"
                        value={formData.endTime}
                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                        className="pl-10"
                      />
                    </div>
                  </div>
                </div>
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

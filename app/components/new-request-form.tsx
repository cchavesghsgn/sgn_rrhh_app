
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
import { formatAvailableTime, hoursToDays, canRequestShift, getTimeBreakdown } from '../lib/time-utils';
import { Paperclip, Upload, Trash2 } from 'lucide-react';

export default function NewRequestForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<any>(null);
  const [availableDays, setAvailableDays] = useState({
    personalHours: 0,
    remoteHours: 0,
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

  const [attachments, setAttachments] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);

  // Calculate hours automatically based on start and end time
  const calculateHours = (startHour: string, endHour: string): number => {
    if (!startHour || !endHour) return 0;
    
    const start = parseInt(startHour);
    const end = parseInt(endHour);
    
    if (end <= start) return 0;
    
    return end - start;
  };

  // Calcular si la fecha está dentro de las próximas 48 horas
  const isWithin48Hours = (startDate: string): boolean => {
    if (!startDate) return false;
    
    const selectedDate = new Date(startDate);
    const now = new Date();
    const hours48Later = new Date(now.getTime() + (48 * 60 * 60 * 1000));
    
    return selectedDate < hours48Later;
  };

  // Generate hour options (00 to 23)
  const hourOptions = Array.from({ length: 24 }, (_, i) => {
    const hour = i.toString().padStart(2, '0');
    return { value: hour, label: `${hour}:00` };
  });

  // Update hours automatically when start/end time changes
  useEffect(() => {
    if (formData.type === LeaveRequestType.HOURS && formData.startTime && formData.endTime) {
      const calculatedHours = calculateHours(formData.startTime, formData.endTime);
      setFormData(prev => ({ ...prev, hours: calculatedHours.toString() }));
    }
  }, [formData.startTime, formData.endTime, formData.type]);

  useEffect(() => {
    const fetchAvailableDays = async () => {
      try {
        const response = await fetch('/api/employees/me');
        if (response.ok) {
          const employeeData = await response.json();
          setEmployee(employeeData);
          setAvailableDays({
            personalHours: employeeData.personalHours,
            remoteHours: employeeData.remoteHours,
            hours: employeeData.availableHours
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
      if (formData.type === LeaveRequestType.HOURS) {
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
          toast.error('Para días particulares/remotos debes completar día y turno');
          return;
        }
        
        // Validate available hours for the requested shift
        const availableHours = getAvailableHoursForType();
        if (!canRequestShift(availableHours, formData.shift)) {
          const shiftNames = {
            'MORNING': 'una mañana (5h)',
            'AFTERNOON': 'una tarde (3h)',
            'FULL_DAY': 'un día completo (8h)'
          };
          const shiftName = shiftNames[formData.shift as keyof typeof shiftNames] || formData.shift;
          toast.error(`No tienes suficientes horas para solicitar ${shiftName}. Disponible: ${formatAvailableTime(availableHours)}`);
          return;
        }
      } else if (formData.type === LeaveRequestType.LICENSE || formData.type === LeaveRequestType.VACATION) {
        if (!formData.startDate || !formData.endDate) {
          const typeLabel = formData.type === LeaveRequestType.LICENSE ? 'licencias' : 'vacaciones';
          toast.error(`Para ${typeLabel} debes completar fecha de inicio y fin`);
          return;
        }
        
        // Additional validation for VACATION
        if (formData.type === LeaveRequestType.VACATION) {
          const requestedDays = calculateDaysNeeded();
          const availableVacationDays = (employee?.vacationDays || 0);
          if (requestedDays > availableVacationDays) {
            toast.error(`No tienes suficientes días de vacaciones. Solicitas: ${requestedDays} días, Disponibles: ${availableVacationDays} días`);
            return;
          }
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
        // Si hay adjuntos, subirlos ahora
        if (attachments.length > 0) {
          try {
            setUploading(true);
            for (const file of attachments) {
              const fd = new FormData();
              fd.append('file', file);
              const upRes = await fetch(`/api/leave-requests/${result.id}/documents`, {
                method: 'POST',
                body: fd,
              });
              if (!upRes.ok) {
                const err = await upRes.json().catch(() => ({}));
                throw new Error(err.error || 'Error al subir adjunto');
              }
            }
          } catch (err) {
            console.error('Error uploading attachments:', err);
            toast.error((err as Error).message || 'Error al subir adjuntos');
          } finally {
            setUploading(false);
          }
        }

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

  const onSelectAttachments = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const selected: File[] = [];
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) {
        toast.error(`El archivo ${f.name} supera 10MB`);
        return;
      }
      if (!allowed.includes(f.type)) {
        toast.error(`Tipo no permitido: ${f.name}`);
        return;
      }
      selected.push(f);
    }
    setAttachments(prev => [...prev, ...selected]);
    // Limpiar input para permitir volver a seleccionar mismo archivo si se quita
    e.currentTarget.value = '';
  };

  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
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
      case LeaveRequestType.VACATION: return `${employee?.vacationDays || 0} de ${employee?.totalVacationDays} días`;
      case LeaveRequestType.PERSONAL: return formatAvailableTime(availableDays.personalHours);
      case LeaveRequestType.REMOTE: return formatAvailableTime(availableDays.remoteHours);
      case LeaveRequestType.HOURS: return availableDays.hours;
      case LeaveRequestType.LICENSE: return 'Sin límite - solo registro';
      default: return null;
    }
  };

  // Get raw hours for validation
  const getAvailableHoursForType = () => {
    switch (formData.type) {
      case LeaveRequestType.VACATION: return employee?.vacationDays || 0;
      case LeaveRequestType.PERSONAL: return availableDays.personalHours;
      case LeaveRequestType.REMOTE: return availableDays.remoteHours;
      case LeaveRequestType.HOURS: return availableDays.hours;
      case LeaveRequestType.LICENSE: return 999; // No limit for licenses
      default: return 0;
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
                      {LEAVE_REQUEST_TYPE_LABELS[LeaveRequestType.LICENSE]} 
                    </SelectItem>
                    <SelectItem value={LeaveRequestType.VACATION}>
                      {LEAVE_REQUEST_TYPE_LABELS[LeaveRequestType.VACATION]} (Disponibles: {employee?.vacationDays || 0} de {employee?.totalVacationDays} días)
                    </SelectItem>
                    <SelectItem value={LeaveRequestType.PERSONAL}>
                      {LEAVE_REQUEST_TYPE_LABELS[LeaveRequestType.PERSONAL]} (Disponibles: {formatAvailableTime(availableDays.personalHours)})
                    </SelectItem>
                    <SelectItem value={LeaveRequestType.REMOTE}>
                      {LEAVE_REQUEST_TYPE_LABELS[LeaveRequestType.REMOTE]} (Disponibles: {formatAvailableTime(availableDays.remoteHours)})
                    </SelectItem>
                    <SelectItem value={LeaveRequestType.HOURS}>
                      {LEAVE_REQUEST_TYPE_LABELS[LeaveRequestType.HOURS]} (Disponibles: {availableDays.hours}h)
                    </SelectItem>
                  </SelectContent>
                </Select>
                {getAvailableForType() !== null && formData.type !== 'LICENSE' && (
                  <p className="text-xs text-gray-600">
                    Tienes {getAvailableForType()} disponibles
                  </p>
                )}
              </div>

              {/* Hours calculation display */}
              {formData.type === LeaveRequestType.HOURS && formData.startTime && formData.endTime && (
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
                      Calculado automáticamente desde {formData.startTime}:00 hasta {formData.endTime}:00
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Date fields based on type */}
            {(formData.type === LeaveRequestType.LICENSE || formData.type === LeaveRequestType.VACATION) && (
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

                {/* Advertencia para solicitudes con menos de 48hs de anticipación */}
                {formData.startDate && isWithin48Hours(formData.startDate) && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800 font-medium">
                      ⚠️ Solicitud con menos de 48 horas de anticipación
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      Deberás justificar la urgencia de esta solicitud en el motivo.
                    </p>
                  </div>
                )}
              </>
            )}

            {/* particular/Remote day fields */}
            {(formData.type === 'PERSONAL' || formData.type === 'REMOTE') && (
              <div className="space-y-6">
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

                {/* Advertencia para solicitudes con menos de 48hs de anticipación */}
                {formData.startDate && isWithin48Hours(formData.startDate) && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800 font-medium">
                      ⚠️ Solicitud con menos de 48 horas de anticipación
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      Deberás justificar la urgencia de esta solicitud en el motivo.
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Hours specific fields */}
            {formData.type === LeaveRequestType.HOURS && (
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
                    <Select 
                      value={formData.startTime || "none"} 
                      onValueChange={(value) => setFormData({ ...formData, startTime: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar hora" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Seleccionar hora</SelectItem>
                        {hourOptions.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* End Time */}
                  <div className="space-y-2">
                    <Label htmlFor="endTime">Hora de Fin *</Label>
                    <Select 
                      value={formData.endTime || "none"} 
                      onValueChange={(value) => setFormData({ ...formData, endTime: value === "none" ? "" : value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar hora" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Seleccionar hora</SelectItem>
                        {hourOptions.map(({ value, label }) => (
                          <SelectItem key={value} value={value}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Advertencia para solicitudes con menos de 48hs de anticipación */}
                {formData.startDate && isWithin48Hours(formData.startDate) && (
                  <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                    <p className="text-sm text-red-800 font-medium">
                      ⚠️ Solicitud con menos de 48 horas de anticipación
                    </p>
                    <p className="text-xs text-red-700 mt-1">
                      Deberás justificar la urgencia de esta solicitud en el motivo.
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

            {/* Attachments */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2"><Paperclip className="h-4 w-4" /> Adjuntar documentos (opcional)</Label>
              <Input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" multiple onChange={onSelectAttachments} />
              {attachments.length > 0 && (
                <div className="space-y-2">
                  {attachments.map((f, idx) => (
                    <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 border rounded">
                      <span className="text-sm truncate mr-2">{f.name}</span>
                      <Button type="button" size="sm" variant="outline" onClick={() => removeAttachment(idx)} className="text-red-600">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              <p className="text-xs text-gray-500">PDF, imágenes o Word. Máx 10MB por archivo.</p>
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

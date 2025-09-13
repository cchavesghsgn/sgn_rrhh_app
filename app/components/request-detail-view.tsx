
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { 
  ArrowLeft,
  Check,
  X,
  User,
  Calendar,
  Clock,
  FileText,
  MessageSquare,
  Upload,
  Trash2,
  Paperclip,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { LeaveRequest, LEAVE_REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS, DAY_SHIFT_LABELS } from '../lib/types';

interface RequestDetailViewProps {
  requestId: string;
}

export default function RequestDetailView({ requestId }: RequestDetailViewProps) {
  const router = useRouter();
  const [request, setRequest] = useState<LeaveRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [adminNotes, setAdminNotes] = useState('');
  const [attachments, setAttachments] = useState<any[]>([]);
  const [attLoading, setAttLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<FileList | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const response = await fetch(`/api/leave-requests?requestId=${requestId}`);
        if (response.ok) {
          const data = await response.json();
          const foundRequest = data.find((r: LeaveRequest) => r.id === requestId);
          if (foundRequest) {
            setRequest(foundRequest);
            setAdminNotes(foundRequest.adminNotes || '');
          }
        }
      } catch (error) {
        console.error('Error fetching request:', error);
      } finally {
        setLoading(false);
      }
    };

    const fetchAttachments = async () => {
      try {
        setAttLoading(true);
        const res = await fetch(`/api/leave-requests/${requestId}/documents`);
        if (res.ok) {
          const docs = await res.json();
          setAttachments(docs || []);
        }
      } catch (err) {
        console.error('Error fetching attachments:', err);
      } finally {
        setAttLoading(false);
      }
    };

    fetchRequest();
    fetchAttachments();
  }, [requestId]);

  const refreshAttachments = async () => {
    try {
      setAttLoading(true);
      const res = await fetch(`/api/leave-requests/${requestId}/documents`);
      if (res.ok) {
        const docs = await res.json();
        setAttachments(docs || []);
      }
    } finally {
      setAttLoading(false);
    }
  };

  const handleFilesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;

    // Validaciones básicas por archivo
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    for (const f of Array.from(files)) {
      if (f.size > 10 * 1024 * 1024) {
        alert(`El archivo ${f.name} supera 10MB`);
        return;
      }
      if (!allowed.includes(f.type)) {
        alert(`Tipo no permitido: ${f.name}`);
        return;
      }
    }
    setSelectedFiles(files);
  };

  const handleUploadAttachments = async () => {
    if (!selectedFiles || selectedFiles.length === 0) return;
    setUploading(true);
    try {
      for (const f of Array.from(selectedFiles)) {
        const fd = new FormData();
        fd.append('file', f);
        const res = await fetch(`/api/leave-requests/${requestId}/documents`, {
          method: 'POST',
          body: fd,
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err.error || 'Error subiendo adjunto');
        }
      }
      setSelectedFiles(null);
      await refreshAttachments();
    } catch (e) {
      console.error(e);
      alert((e as Error).message || 'Error al subir adjuntos');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('¿Eliminar este adjunto?')) return;
    try {
      const res = await fetch(`/api/leave-requests/${requestId}/documents/${attachmentId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error || 'Error al eliminar adjunto');
        return;
      }
      await refreshAttachments();
    } catch (e) {
      console.error(e);
      alert('Error al eliminar adjunto');
    }
  };

  const handleApprove = async () => {
    if (!request) return;
    
    setProcessing(true);
    try {
      const response = await fetch(`/api/leave-requests/${request.id}/approve`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminNotes }),
      });

      if (response.ok) {
        toast.success('Solicitud aprobada exitosamente');
        router.push('/admin/requests');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al aprobar la solicitud');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Error al aprobar la solicitud');
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!request) return;
    
    setProcessing(true);
    try {
      const response = await fetch(`/api/leave-requests/${request.id}/reject`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ adminNotes }),
      });

      if (response.ok) {
        toast.success('Solicitud rechazada');
        router.push('/admin/requests');
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al rechazar la solicitud');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Error al rechazar la solicitud');
    } finally {
      setProcessing(false);
    }
  };

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
        <div className="h-64 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }

  if (!request) {
    return (
      <Card className="sgn-card">
        <CardContent className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Solicitud no encontrada
          </h3>
          <p className="text-gray-600 mb-6">
            La solicitud que buscas no existe o no tienes permisos para verla
          </p>
          <Link href="/admin/requests">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Volver a Solicitudes
            </Button>
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/admin/requests">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold text-sgn-dark">
            Detalle de Solicitud
          </h1>
          <p className="text-gray-600">
            Revisa y gestiona la solicitud de permiso
          </p>
        </div>
      </div>

      {/* Request Details */}
      <Card className="sgn-card">
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-sgn-blue" />
              {request.employee?.firstName} {request.employee?.lastName}
            </div>
            <Badge variant={getStatusBadgeVariant(request.status)}>
              {REQUEST_STATUS_LABELS[request.status]}
            </Badge>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Tipo de Solicitud</p>
              <p className="font-medium">{LEAVE_REQUEST_TYPE_LABELS[request.type]}</p>
            </div>

            {/* License type shows date range */}
            {request.type === 'LICENSE' && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Fecha de Inicio</p>
                  <p className="font-medium">{formatDate(request.startDate.toString())}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Fecha de Fin</p>
                  <p className="font-medium">{formatDate(request.endDate.toString())}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Duración</p>
                  <p className="font-medium">
                    {request.isHalfDay ? '0.5 días' : 
                     `${Math.ceil((new Date(request.endDate).getTime() - new Date(request.startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1} días`}
                  </p>
                </div>
              </>
            )}

            {/* Personal/Remote type shows single day and shift */}
            {(request.type === 'PERSONAL' || request.type === 'REMOTE') && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Día</p>
                  <p className="font-medium">{formatDate(request.startDate.toString())}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Turno</p>
                  <p className="font-medium">
                    {request.shift ? DAY_SHIFT_LABELS[request.shift as keyof typeof DAY_SHIFT_LABELS] : 'No especificado'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Duración</p>
                  <p className="font-medium">
                    {(request.shift === 'MORNING' || request.shift === 'AFTERNOON') ? '0.5 días' : '1 día'}
                  </p>
                </div>
              </>
            )}

            {/* Hours type shows day, hours and time range */}
            {request.type === 'HOURS' && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Día</p>
                  <p className="font-medium">{formatDate(request.startDate.toString())}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Cantidad</p>
                  <p className="font-medium">{request.hours} horas</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Horario</p>
                  <p className="font-medium">
                    {request.startTime && request.endTime ? 
                      `${request.startTime} - ${request.endTime}` : 
                      'No especificado'}
                  </p>
                </div>
              </>
            )}
          </div>

          {/* Employee Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Área</p>
              <p className="font-medium">{request.employee?.area?.name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Cargo</p>
              <p className="font-medium">{request.employee?.position}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Email</p>
              <p className="font-medium">{request.employee?.user?.email}</p>
            </div>
          </div>

          {/* Reason */}
          <div>
            <p className="text-sm text-gray-600 mb-2">Motivo de la Solicitud</p>
            <div className="p-4 bg-gray-50 rounded-lg">
              <p>{request.reason}</p>
            </div>
          </div>

          {/* Attachments */}
          <div className="space-y-3">
            <p className="text-sm text-gray-600 mb-1 flex items-center gap-2">
              <Paperclip className="h-4 w-4" /> Adjuntos
            </p>

            {/* Uploader */}
            <div className="p-3 border rounded-lg bg-gray-50">
              <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
                <div className="flex-1">
                  <Label htmlFor="attachments" className="sr-only">Adjuntar archivos</Label>
                  <Input id="attachments" type="file" multiple accept=".pdf,.jpg,.jpeg,.png,.doc,.docx" onChange={handleFilesChange} />
                </div>
                <Button onClick={handleUploadAttachments} disabled={!selectedFiles || uploading} className="md:w-auto w-full">
                  {uploading ? (
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                      Subiendo...
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4" /> Subir
                    </div>
                  )}
                </Button>
              </div>
              {selectedFiles && selectedFiles.length > 0 && (
                <p className="text-xs text-gray-600 mt-2">{selectedFiles.length} archivo(s) seleccionado(s)</p>
              )}
            </div>

            {/* List */}
            <div className="space-y-2">
              {attLoading ? (
                <p className="text-gray-500">Cargando adjuntos...</p>
              ) : attachments.length === 0 ? (
                <p className="text-gray-500">No hay adjuntos</p>
              ) : (
                attachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <FileText className="h-5 w-5 text-sgn-blue" />
                      <div>
                        <p className="font-medium text-sm">{att.originalName || att.fileName}</p>
                        <p className="text-xs text-gray-500">{att.fileType} • {(att.fileSize / 1024).toFixed(1)} KB</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" onClick={() => window.open(att.filePath || `/api/files/attachments/${att.fileName}`, '_blank')}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDeleteAttachment(att.id)} className="text-red-600 hover:text-red-700">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Admin Notes */}
          <div>
            <p className="text-sm text-gray-600 mb-2">Notas del Administrador</p>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              className="w-full min-h-[80px] px-3 py-2 border border-input rounded-md text-sm resize-none focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Agrega notas o comentarios sobre esta solicitud..."
              disabled={request.status !== 'PENDING'}
            />
          </div>

          {/* Actions */}
          {request.status === 'PENDING' && (
            <div className="flex gap-4 pt-4 border-t">
              <Button
                onClick={handleReject}
                disabled={processing}
                variant="destructive"
                className="flex-1"
              >
                {processing ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Procesando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <X className="h-4 w-4" />
                    Rechazar
                  </div>
                )}
              </Button>
              
              <Button
                onClick={handleApprove}
                disabled={processing}
                className="flex-1"
              >
                {processing ? (
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Procesando...
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <Check className="h-4 w-4" />
                    Aprobar
                  </div>
                )}
              </Button>
            </div>
          )}

          {/* Existing Admin Notes (if processed) */}
          {request.status !== 'PENDING' && request.adminNotes && (
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="flex items-start gap-2">
                <MessageSquare className="h-4 w-4 text-sgn-blue mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-blue-900 mb-1">Notas del Administrador:</p>
                  <p className="text-sm text-blue-800">{request.adminNotes}</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

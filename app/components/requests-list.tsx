
'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  FileText,
  Plus,
  Calendar,
  Clock,
  User,
  MessageSquare
} from 'lucide-react';
import Link from 'next/link';
import { LeaveRequest, LEAVE_REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from '../lib/types';

export default function RequestsList() {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRequests = async () => {
      try {
        const response = await fetch('/api/leave-requests');
        if (response.ok) {
          const data = await response.json();
          setRequests(data);
        }
      } catch (error) {
        console.error('Error fetching requests:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchRequests();
  }, []);

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

  const calculateDays = (startDate: string, endDate: string, isHalfDay: boolean) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
    
    if (isHalfDay && diffDays === 1) {
      return '0.5 días';
    }
    
    return `${diffDays} día${diffDays > 1 ? 's' : ''}`;
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header Actions */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <p className="text-gray-600">
            Total: <span className="font-semibold">{requests.length}</span> solicitudes
          </p>
        </div>
        <Link href="/requests/new">
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Nueva Solicitud
          </Button>
        </Link>
      </div>

      {/* Requests List */}
      {requests.length > 0 ? (
        <div className="space-y-4">
          {requests.map((request) => (
            <Card key={request.id} className="sgn-card">
              <CardContent className="p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <FileText className="h-5 w-5 text-sgn-blue" />
                      <h3 className="font-semibold text-lg">
                        {LEAVE_REQUEST_TYPE_LABELS[request.type]}
                      </h3>
                      <Badge variant={getStatusBadgeVariant(request.status)}>
                        {REQUEST_STATUS_LABELS[request.status]}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="flex items-center gap-2 text-gray-600">
                        <Calendar className="h-4 w-4" />
                        <span className="text-sm">
                          {formatDate(request.startDate.toString())} - {formatDate(request.endDate.toString())}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-600">
                        <Clock className="h-4 w-4" />
                        <span className="text-sm">
                          {request.type === 'HOURS' 
                            ? `${request.hours} horas`
                            : calculateDays(request.startDate.toString(), request.endDate.toString(), request.isHalfDay)
                          }
                        </span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <p className="text-sm text-gray-600 mb-1">Motivo:</p>
                      <p className="text-sm bg-gray-50 p-3 rounded-lg">{request.reason}</p>
                    </div>

                    {request.adminNotes && (
                      <div>
                        <p className="text-sm text-gray-600 mb-1">Notas del administrador:</p>
                        <div className="flex items-start gap-2">
                          <MessageSquare className="h-4 w-4 text-sgn-blue mt-0.5" />
                          <p className="text-sm bg-blue-50 p-3 rounded-lg flex-1">{request.adminNotes}</p>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="ml-6 text-right">
                    <p className="text-xs text-gray-500">
                      Solicitado el {formatDate(request.createdAt.toString())}
                    </p>
                    {request.status === 'PENDING' && (
                      <p className="text-xs text-yellow-600 mt-1">
                        Pendiente de aprobación
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card className="sgn-card">
          <CardContent className="p-12 text-center">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No tienes solicitudes
            </h3>
            <p className="text-gray-600 mb-6">
              Crea tu primera solicitud de permiso para comenzar
            </p>
            <Link href="/requests/new">
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Nueva Solicitud
              </Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

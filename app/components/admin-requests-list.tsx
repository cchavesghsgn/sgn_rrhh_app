
'use client';

import { useEffect, useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { 
  FileText,
  Check,
  X,
  Eye,
  User,
  Calendar,
  Clock
} from 'lucide-react';
import Link from 'next/link';
import { LeaveRequest, LEAVE_REQUEST_TYPE_LABELS, REQUEST_STATUS_LABELS } from '../lib/types';

export default function AdminRequestsList() {
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

  const pendingRequests = requests.filter(r => r.status === 'PENDING');
  const processedRequests = requests.filter(r => r.status !== 'PENDING');

  if (loading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg animate-pulse"></div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-yellow-600">{pendingRequests.length}</p>
            <p className="text-sm text-gray-600">Pendientes</p>
          </CardContent>
        </Card>
        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-green-600">
              {requests.filter(r => r.status === 'APPROVED').length}
            </p>
            <p className="text-sm text-gray-600">Aprobadas</p>
          </CardContent>
        </Card>
        <Card className="sgn-card">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-red-600">
              {requests.filter(r => r.status === 'REJECTED').length}
            </p>
            <p className="text-sm text-gray-600">Rechazadas</p>
          </CardContent>
        </Card>
      </div>

      {/* Pending Requests */}
      {pendingRequests.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold text-sgn-dark mb-4">
            Solicitudes Pendientes ({pendingRequests.length})
          </h2>
          <div className="space-y-4">
            {pendingRequests.map((request) => (
              <Card key={request.id} className="sgn-card border-l-4 border-l-yellow-500">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <User className="h-5 w-5 text-sgn-blue" />
                        <h3 className="font-semibold text-lg">
                          {request.employee?.firstName} {request.employee?.lastName}
                        </h3>
                        <Badge variant="pending">
                          {REQUEST_STATUS_LABELS[request.status]}
                        </Badge>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <p className="text-sm text-gray-600">Tipo</p>
                          <p className="font-medium">{LEAVE_REQUEST_TYPE_LABELS[request.type]}</p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Período</p>
                          <p className="font-medium text-sm">
                            {formatDate(request.startDate.toString())} - {formatDate(request.endDate.toString())}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-gray-600">Duración</p>
                          <p className="font-medium">
                            {request.type === 'HOURS' 
                              ? `${request.hours} horas`
                              : calculateDays(request.startDate.toString(), request.endDate.toString(), request.isHalfDay)
                            }
                          </p>
                        </div>
                      </div>

                      <div className="mb-4">
                        <p className="text-sm text-gray-600 mb-1">Motivo:</p>
                        <p className="text-sm bg-gray-50 p-3 rounded-lg">{request.reason}</p>
                      </div>
                    </div>

                    <div className="ml-6 flex flex-col gap-2">
                      <Link href={`/admin/requests/${request.id}`}>
                        <Button size="sm">
                          <Eye className="h-4 w-4 mr-2" />
                          Ver Detalle
                        </Button>
                      </Link>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Processed Requests */}
      <div>
        <h2 className="text-xl font-semibold text-sgn-dark mb-4">
          Solicitudes Procesadas ({processedRequests.length})
        </h2>
        {processedRequests.length > 0 ? (
          <div className="space-y-4">
            {processedRequests.slice(0, 10).map((request) => (
              <Card key={request.id} className="sgn-card">
                <CardContent className="p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <User className="h-4 w-4 text-sgn-blue" />
                        <span className="font-medium">
                          {request.employee?.firstName} {request.employee?.lastName}
                        </span>
                        <span className="text-sm text-gray-600">
                          {LEAVE_REQUEST_TYPE_LABELS[request.type]}
                        </span>
                        <Badge variant={getStatusBadgeVariant(request.status)}>
                          {REQUEST_STATUS_LABELS[request.status]}
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatDate(request.startDate.toString())} - {formatDate(request.endDate.toString())}
                      </p>
                    </div>
                    <p className="text-xs text-gray-500">
                      {formatDate(request.updatedAt?.toString() || request.createdAt.toString())}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="sgn-card">
            <CardContent className="p-8 text-center">
              <FileText className="h-8 w-8 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No hay solicitudes procesadas</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

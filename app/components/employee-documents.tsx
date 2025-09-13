'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { 
  FileText, 
  Upload,
  Trash2,
  Eye,
  File,
  FileImage
} from 'lucide-react';

interface Document {
  id: string;
  fileName: string;
  originalName: string;
  filePath: string;
  fileType: string;
  fileSize: number;
  documentType: string;
  createdAt: string;
}

interface EmployeeDocumentsProps {
  employeeId: string;
}

const documentTypes = [
  { value: 'CV', label: 'Curriculum Vitae' },
  { value: 'DNI', label: 'Documento de Identidad' },
  { value: 'CUIL', label: 'CUIL' },
  { value: 'TITULO', label: 'Título/Certificado' },
  { value: 'CONTRATO', label: 'Contrato' },
  { value: 'CERTIFICADO_MEDICO', label: 'Certificado Médico' },
  { value: 'OTROS', label: 'Otros' }
];

const getFileIcon = (fileType: string) => {
  if (fileType.includes('pdf')) return <FileText className="h-5 w-5 text-red-500" />;
  if (fileType.includes('image')) return <FileImage className="h-5 w-5 text-blue-500" />;
  if (fileType.includes('word') || fileType.includes('document')) return <File className="h-5 w-5 text-blue-600" />;
  return <FileText className="h-5 w-5 text-gray-500" />;
};

const formatFileSize = (bytes: number) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export default function EmployeeDocuments({ employeeId }: EmployeeDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState('');

  // Cargar documentos del empleado
  const fetchDocuments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/employees/${employeeId}/documents`);
      if (response.ok) {
        const data = await response.json();
        setDocuments(data.documents);
      } else {
        toast.error('Error al cargar documentos');
      }
    } catch (error) {
      console.error('Error fetching documents:', error);
      toast.error('Error al cargar documentos');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (employeeId) {
      fetchDocuments();
    }
  }, [employeeId]);

  // Manejar selección de archivo
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tamaño (máx 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('El archivo es demasiado grande (máx 10MB)');
        return;
      }

      // Validar tipo
      const allowedTypes = [
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/jpg',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
      ];

      if (!allowedTypes.includes(file.type)) {
        toast.error('Tipo de archivo no permitido. Solo se permiten PDF, imágenes y documentos de Word');
        return;
      }

      setSelectedFile(file);
    }
  };

  // Subir documento
  const handleUpload = async () => {
    if (!selectedFile || !documentType) {
      toast.error('Selecciona un archivo y tipo de documento');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('documentType', documentType);

      const response = await fetch(`/api/employees/${employeeId}/documents`, {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        toast.success('Documento subido exitosamente');
        setSelectedFile(null);
        setDocumentType('');
        // Limpiar input
        const fileInput = document.getElementById('document-file') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
        // Recargar documentos
        fetchDocuments();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al subir documento');
      }
    } catch (error) {
      console.error('Error uploading document:', error);
      toast.error('Error al subir documento');
    } finally {
      setUploading(false);
    }
  };

  // Ver documento
  const handleView = (document: Document) => {
    window.open(`/api/employees/${employeeId}/documents/${document.id}`, '_blank');
  };

  // Eliminar documento
  const handleDelete = async (documentId: string) => {
    if (!confirm('¿Estás seguro de que quieres eliminar este documento?')) {
      return;
    }

    try {
      const response = await fetch(`/api/employees/${employeeId}/documents/${documentId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        toast.success('Documento eliminado exitosamente');
        fetchDocuments();
      } else {
        const error = await response.json();
        toast.error(error.error || 'Error al eliminar documento');
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      toast.error('Error al eliminar documento');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Documentos del Empleado
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Formulario de subida */}
        <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
          <h4 className="font-medium">Subir Nuevo Documento</h4>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="document-file">Archivo</Label>
              <Input
                id="document-file"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={handleFileSelect}
              />
              {selectedFile && (
                <p className="text-sm text-gray-600">
                  Archivo seleccionado: {selectedFile.name} ({formatFileSize(selectedFile.size)})
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="document-type">Tipo de Documento</Label>
              <Select value={documentType} onValueChange={setDocumentType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona el tipo" />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button 
            onClick={handleUpload} 
            disabled={!selectedFile || !documentType || uploading}
            className="w-full"
          >
            <Upload className="h-4 w-4 mr-2" />
            {uploading ? 'Subiendo...' : 'Subir Documento'}
          </Button>
        </div>

        {/* Lista de documentos */}
        <div className="space-y-2">
          <h4 className="font-medium">Documentos Existentes</h4>
          
          {loading ? (
            <p className="text-gray-500">Cargando documentos...</p>
          ) : documents.length === 0 ? (
            <p className="text-gray-500">No hay documentos cargados</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc) => (
                <div key={doc.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getFileIcon(doc.fileType)}
                    <div>
                      <p className="font-medium">{doc.originalName}</p>
                      <p className="text-sm text-gray-500">
                        {documentTypes.find(t => t.value === doc.documentType)?.label || doc.documentType} • {formatFileSize(doc.fileSize)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleView(doc)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(doc.id)}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
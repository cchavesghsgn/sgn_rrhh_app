import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { putObject, buildKey } from '@/lib/s3';

// GET - Listar documentos de un empleado
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que el empleado existe
    const employee = await prisma.employees.findUnique({
      where: { id: params.id }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    // Obtener documentos del empleado
    const documents = await prisma.employee_documents.findMany({
      where: { employeeId: params.id },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error('Error fetching employee documents:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

// POST - Subir un nuevo documento
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    // Verificar que el empleado existe
    const employee = await prisma.employees.findUnique({
      where: { id: params.id }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Empleado no encontrado' }, { status: 404 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const documentType = formData.get('documentType') as string;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
    }

    if (!documentType) {
      return NextResponse.json({ error: 'Tipo de documento requerido' }, { status: 400 });
    }

    // Validar tamaño del archivo (máx 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'El archivo es demasiado grande (máx 10MB)' }, { status: 400 });
    }

    // Validar tipo de archivo
    const allowedTypes = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'image/jpg',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];

    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json({ 
        error: 'Tipo de archivo no permitido. Solo se permiten PDF, imágenes y documentos de Word' 
      }, { status: 400 });
    }

    // Generar nombre único para el archivo
    const fileExtension = file.name.split('.').pop() || 'bin';
    const fileName = `doc-${params.id}-${Date.now()}.${fileExtension}`;
    const filePath = `/api/files/documents/${fileName}`;

    // Guardar archivo
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const key = buildKey(`documents/${fileName}`);
    await putObject(key, buffer, file.type);

    // Guardar información en la base de datos
    const document = await prisma.employee_documents.create({
      data: {
        id: `doc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        employeeId: params.id,
        fileName: fileName,
        originalName: file.name,
        filePath: filePath,
        fileType: file.type,
        fileSize: file.size,
        documentType: documentType
      }
    });

    return NextResponse.json({ 
      message: 'Documento subido exitosamente',
      document 
    });

  } catch (error) {
    console.error('Error uploading document:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

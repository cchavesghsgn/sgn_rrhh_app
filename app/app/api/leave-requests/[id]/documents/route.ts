import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { v4 as uuidv4 } from 'uuid';
import { putObject, buildKey } from '@/lib/s3';

// GET - Listar documentos de una solicitud
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const leaveRequestId = params.id;

    // Verificar que la solicitud existe y el usuario tiene acceso
    const leaveRequest = await prisma.leave_requests.findUnique({
      where: { id: leaveRequestId },
      include: {
        employees: {
          include: {
            User: true
          }
        }
      }
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Verificar permisos: el empleado propietario o un admin
    const isOwner = leaveRequest.employees.userId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Sin permisos para ver estos documentos' }, { status: 403 });
    }

    // Obtener documentos de la solicitud
    const documents = await prisma.attachments.findMany({
      where: { leaveRequestId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(documents);
  } catch (error) {
    console.error('Error al obtener documentos de solicitud:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

// POST - Subir un nuevo documento a una solicitud
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
    }

    const leaveRequestId = params.id;

    // Verificar que la solicitud existe y el usuario tiene acceso
    const leaveRequest = await prisma.leave_requests.findUnique({
      where: { id: leaveRequestId },
      include: {
        employees: {
          include: {
            User: true
          }
        }
      }
    });

    if (!leaveRequest) {
      return NextResponse.json({ error: 'Solicitud no encontrada' }, { status: 404 });
    }

    // Verificar permisos: el empleado propietario o un admin
    const isOwner = leaveRequest.employees.userId === session.user.id;
    const isAdmin = session.user.role === 'ADMIN';

    if (!isOwner && !isAdmin) {
      return NextResponse.json({ error: 'Sin permisos para subir documentos a esta solicitud' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;

    if (!file) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 });
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
        error: 'Tipo de archivo no permitido. Solo se permiten PDF, imágenes y documentos de Word.' 
      }, { status: 400 });
    }

    // Validar tamaño (10MB máximo)
    const maxSize = 10 * 1024 * 1024; // 10MB
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: 'El archivo es demasiado grande. Máximo 10MB.' 
      }, { status: 400 });
    }

    // Generar nombre único para el archivo
    const fileExtension = file.name.split('.').pop();
    const uniqueFileName = `request-${leaveRequestId}-${Date.now()}-${uuidv4()}.${fileExtension}`;

    // Guardar archivo en S3
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const key = buildKey(`attachments/${uniqueFileName}`);
    await putObject(key, buffer, file.type);

    // Guardar información en la base de datos
    const attachment = await prisma.attachments.create({
      data: {
        id: uuidv4(),
        leaveRequestId,
        fileName: uniqueFileName,
        originalName: file.name,
        // Mantener compatibilidad de front: servimos por el endpoint interno que redirige a S3
        filePath: `/api/files/attachments/${uniqueFileName}`,
        fileType: file.type,
        fileSize: file.size
      }
    });

    return NextResponse.json(attachment, { status: 201 });
  } catch (error) {
    console.error('Error al subir documento de solicitud:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}

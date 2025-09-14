import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'mime-types';
import { buildKey, getSignedGetUrl } from '@/lib/s3';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string[] } }
) {
  try {
    // Expected paths: /api/files/attachments/<name> or /api/files/documents/<name>
    const filepath = params.filename.join('/');
    const key = buildKey(filepath);
    const mimeType = (lookup(filepath) as string) || 'application/octet-stream';

    const url = await getSignedGetUrl(key, mimeType);
    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    console.error('Error generating signed URL:', error);
    return new NextResponse('File not found', { status: 404 });
  }
}

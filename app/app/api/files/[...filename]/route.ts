import { NextRequest, NextResponse } from 'next/server';
import { lookup } from 'mime-types';
import { buildKey, getSignedGetUrl, UPLOADS_BUCKET, UPLOADS_PREFIX, REGION } from '@/lib/s3';

export async function GET(
  request: NextRequest,
  { params }: { params: { filename: string[] } }
) {
  try {
    // Expected paths: /api/files/attachments/<name> or /api/files/documents/<name>
    const filepath = params.filename.join('/');
    const key = buildKey(filepath);
    const mimeType = (lookup(filepath) as string) || 'application/octet-stream';

    console.log('[S3][FILES GET] bucket=%s region=%s prefix=%s key=%s mime=%s', UPLOADS_BUCKET, REGION, UPLOADS_PREFIX || '(none)', key, mimeType);

    const url = await getSignedGetUrl(key, mimeType);
    return NextResponse.redirect(url, { status: 302 });
  } catch (error) {
    console.error('[S3][FILES GET] Error generating signed URL:', error);
    return new NextResponse('File not found', { status: 404 });
  }
}

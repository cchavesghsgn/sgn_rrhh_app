import { S3Client, PutObjectCommand, DeleteObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// Amplify restringe variables que comienzan con AWS_. Soportamos ambas.
const REGION = process.env.REGION_AWS || process.env.AWS_REGION || 'us-east-1';
export const UPLOADS_BUCKET = process.env.S3_BUCKET_UPLOADS || '';
export const UPLOADS_PREFIX = (process.env.S3_UPLOADS_PREFIX || '').replace(/^\/+|\/+$/g, ''); // trim slashes

export const s3 = new S3Client({ region: REGION });

export const buildKey = (subpath: string) => {
  const clean = subpath.replace(/^\/+/, '');
  return UPLOADS_PREFIX ? `${UPLOADS_PREFIX}/${clean}` : clean;
};

export const putObject = async (key: string, body: Buffer | Uint8Array | Blob | string, contentType: string) => {
  const cmd = new PutObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key, Body: body, ContentType: contentType });
  return s3.send(cmd);
};

export const deleteObject = async (key: string) => {
  const cmd = new DeleteObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key });
  return s3.send(cmd);
};

export const getSignedGetUrl = async (key: string, contentType?: string, attachmentName?: string, expiresInSeconds = 300) => {
  const headers: Record<string, string> = {};
  if (contentType) headers['ResponseContentType'] = contentType as any;
  if (attachmentName) headers['ResponseContentDisposition'] = `inline; filename="${attachmentName}"` as any;
  const cmd = new GetObjectCommand({ Bucket: UPLOADS_BUCKET, Key: key, ...headers } as any);
  return getSignedUrl(s3, cmd, { expiresIn: expiresInSeconds });
};

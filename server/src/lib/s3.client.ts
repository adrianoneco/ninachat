import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import fs from 'fs-extra';
import path from 'path';

const useSsl = process.env.MINIO_USE_SSL === 'true';
const host = process.env.MINIO_ENDPOINT || 'localhost';
const port = process.env.MINIO_PORT || '9003';
const endpoint = `${useSsl ? 'https' : 'http'}://${host}:${port}`;
const region = process.env.MINIO_REGION || 'us-east-1';
const accessKey = process.env.MINIO_USER || process.env.MINIO_ACCESS_KEY || '';
const secretKey =
  process.env.MINIO_PASSWORD || process.env.MINIO_SECRET_KEY || '';
const bucket =
  process.env.MINIO_BUCKET_NAME || process.env.MINIO_BUCKET || 'livechat';

let client: S3Client | null = null;
if (accessKey && secretKey) {
  client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  } as any);
}

export function getS3Client(): S3Client | null {
  return client;
}

export function getS3Bucket(): string {
  return bucket;
}

/** Ensure the bucket exists, create it if not. */
export async function ensureBucket(): Promise<void> {
  if (!client) return;
  try {
    await client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch {
    try {
      await client.send(new CreateBucketCommand({ Bucket: bucket }));
    } catch (e) {
      // bucket may already exist or we lack permissions – log and proceed
      console.warn('[S3] failed to create bucket:', String(e));
    }
  }
}

/** Upload a Buffer to S3/MinIO and return the key. */
export async function uploadBufferToS3(
  buffer: Buffer,
  key: string,
  contentType = 'application/octet-stream',
): Promise<string> {
  if (!client) throw new Error('S3 client not configured');
  await ensureBucket();
  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    }),
  );
  return key;
}

/** Generate a presigned GET URL with a given expiration (default 8 hours).
 *  If MINIO_PUBLIC_URL is set, the internal endpoint in the URL is rewritten
 *  to that value so browsers can reach it directly.
 */
export async function getPresignedUrl(
  key: string,
  expiresInSeconds = 8 * 60 * 60,
): Promise<string> {
  if (!client) throw new Error('S3 client not configured');
  const command = new GetObjectCommand({ Bucket: bucket, Key: key });
  const signed = await getSignedUrl(client, command, { expiresIn: expiresInSeconds });

  const publicBase = process.env.MINIO_PUBLIC_URL;
  if (publicBase) {
    // Replace the internal endpoint (scheme+host+port) with the public URL.
    const internalUrl = new URL(endpoint);
    const publicUrl = new URL(publicBase);
    return signed.replace(
      `${internalUrl.protocol}//${internalUrl.host}`,
      `${publicUrl.protocol}//${publicUrl.host}`,
    );
  }

  return signed;
}

export async function uploadDirToS3(localDir: string, prefix = '') {
  if (!client) return;
  const files = await fs.readdir(localDir);
  for (const f of files) {
    const full = path.join(localDir, f);
    const stat = await fs.stat(full);
    if (stat.isDirectory()) {
      await uploadDirToS3(full, `${prefix}${f}/`);
      continue;
    }
    const body = await fs.readFile(full);
    const key = `${prefix}${f}`;
    await client.send(
      new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }),
    );
  }
}

import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import fs from 'fs-extra';
import path from 'path';

const endpoint = process.env.MINIO_ENDPOINT;
const region = process.env.MINIO_REGION || 'us-east-1';
const accessKey = process.env.MINIO_ACCESS_KEY;
const secretKey = process.env.MINIO_SECRET_KEY;
const bucket = process.env.MINIO_BUCKET || 'wpp-sessions';

let client: S3Client | null = null;
if (endpoint && accessKey && secretKey) {
  client = new S3Client({
    region,
    endpoint,
    credentials: { accessKeyId: accessKey, secretAccessKey: secretKey },
    forcePathStyle: true,
  } as any);
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
    await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: body }));
  }
}

import { Controller, Post, Body, HttpException, HttpStatus } from '@nestjs/common';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

function ensureDir(path: string) {
  return mkdir(path, { recursive: true });
}

function parseDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.*)$/);
  if (!match) return null;
  return { mime: match[1], buffer: Buffer.from(match[2], 'base64') };
}

@Controller('uploads')
export class UploadsController {
  private uploadDir = join(__dirname, '..', '..', '..', 'uploads');

  @Post()
  async upload(@Body() body: { filename?: string; data?: string }) {
    const { filename, data } = body || ({} as any);
    if (!filename || !data) {
      throw new HttpException('filename and data are required', HttpStatus.BAD_REQUEST);
    }

    const parsed = parseDataUrl(data);
    const name = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
    try {
      await ensureDir(this.uploadDir);
      if (parsed) {
        const out = join(this.uploadDir, name);
        await writeFile(out, parsed.buffer);
      } else {
        // If not a data URL, assume raw base64
        const buf = Buffer.from(data, 'base64');
        const out = join(this.uploadDir, name);
        await writeFile(out, buf);
      }

      // Return a URL path that the frontend can fetch via the proxy
      return { url: `/uploads/${name}` };
    } catch (e) {
      throw new HttpException('failed to save upload', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }
}

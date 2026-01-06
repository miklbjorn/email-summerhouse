/**
 * R2 file serving handlers
 */

export interface R2Bucket {
  get(key: string): Promise<R2Object | null>;
}

export interface R2Object {
  body: ReadableStream;
  httpMetadata?: {
    contentType?: string;
  };
}

function inferContentType(path: string): string {
  const ext = path.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    pdf: 'application/pdf',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    json: 'application/json',
    md: 'text/markdown',
    txt: 'text/plain',
    html: 'text/html',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

export async function serveFileFromR2(
  r2: R2Bucket,
  path: string
): Promise<Response> {
  const object = await r2.get(path);

  if (!object) {
    return new Response('File not found', { status: 404 });
  }

  const headers = new Headers();

  const contentType = object.httpMetadata?.contentType || inferContentType(path);
  headers.set('Content-Type', contentType);

  const filename = path.split('/').pop() || 'file';
  headers.set('Content-Disposition', `inline; filename="${filename}"`);

  headers.set('Cache-Control', 'public, max-age=3600');

  return new Response(object.body, { headers });
}

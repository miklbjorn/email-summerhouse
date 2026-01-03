/**
 * Email validation and utility functions
 */

export interface EmailEnv {
  ALLOWED_SENDER_EMAIL_ADDRESS_1?: string;
  ALLOWED_SENDER_EMAIL_ADDRESS_2?: string;
}

export interface ProcessedAttachment {
  filename: string;
  contentType: string;
  data: ArrayBuffer;
}

/**
 * Get allowed senders from environment variables
 */
export function getAllowedSenders(env: EmailEnv): string[] {
  return [
    env.ALLOWED_SENDER_EMAIL_ADDRESS_1,
    env.ALLOWED_SENDER_EMAIL_ADDRESS_2,
  ].filter((addr): addr is string => typeof addr === 'string');
}

/**
 * Extract message ID from parsed email and message headers
 * Tries multiple sources in order of preference
 */
export function extractMessageId(
  parsedEmail: { messageId?: string; headers?: any },
  messageHeaders: Headers
): string {
  let messageId = parsedEmail.messageId;

  if (!messageId && parsedEmail.headers) {
    if (Array.isArray(parsedEmail.headers)) {
      const messageIdHeader = parsedEmail.headers.find(
        (h: any) =>
          (h.key && h.key.toLowerCase() === 'message-id') ||
          (h.name && h.name.toLowerCase() === 'message-id')
      );
      messageId = messageIdHeader?.value;
    } else if (typeof (parsedEmail.headers as any).get === 'function') {
      messageId = (parsedEmail.headers as any).get('message-id');
    }
  }

  messageId = messageId || messageHeaders.get('Message-ID') || `msg-${Date.now()}`;

  return messageId;
}

/**
 * Extract email addresses from parsed email address objects
 * Returns an array of string addresses, filtering out any undefined/null values
 */
export function extractEmailAddresses(
  addresses?: Array<{ address?: string | null }>
): string[] {
  if (!addresses) {
    return [];
  }
  // In practice, addr.address should always be a string when the address object exists,
  // but we filter to ensure type safety and handle edge cases
  return addresses
    .map((addr) => addr.address)
    .filter((addr): addr is string => typeof addr === 'string' && addr.length > 0);
}

/**
 * Convert various buffer types to ArrayBuffer
 * Handles ArrayBuffer, SharedArrayBuffer, Uint8Array, string, and Blob-like objects
 */
async function toArrayBuffer(
  input: ArrayBuffer | SharedArrayBuffer | Uint8Array | string | any
): Promise<ArrayBuffer> {
  // Handle ArrayBuffer directly
  if (input instanceof ArrayBuffer) {
    return input;
  }

  // Handle SharedArrayBuffer by copying
  if (input instanceof SharedArrayBuffer) {
    const view = new Uint8Array(input);
    const newBuffer = new ArrayBuffer(view.length);
    new Uint8Array(newBuffer).set(view);
    return newBuffer;
  }

  // Handle Uint8Array by copying
  if (input instanceof Uint8Array) {
    const newBuffer = new ArrayBuffer(input.length);
    new Uint8Array(newBuffer).set(input);
    return newBuffer;
  }

  // Handle string by encoding
  if (typeof input === 'string') {
    const encoder = new TextEncoder();
    const encoded = encoder.encode(input);
    const newBuffer = new ArrayBuffer(encoded.length);
    new Uint8Array(newBuffer).set(encoded);
    return newBuffer;
  }

  // Handle Blob-like objects (have arrayBuffer method)
  if (input && typeof input.arrayBuffer === 'function') {
    const buffer = await input.arrayBuffer();
    // Recursively handle the result in case it's not an ArrayBuffer
    return toArrayBuffer(buffer);
  }

  // Fallback: try to convert via Uint8Array
  try {
    const view = new Uint8Array(input);
    const newBuffer = new ArrayBuffer(view.length);
    new Uint8Array(newBuffer).set(view);
    return newBuffer;
  } catch (error) {
    throw new Error(
      `Unable to convert input to ArrayBuffer. Type: ${typeof input}, Error: ${error}`
    );
  }
}

/**
 * Process email attachments and convert them to a standardized format
 * Handles all type conversions internally
 */
export async function processAttachments(
  attachments: Array<{
    filename?: string | null;
    mimeType?: string | null;
    content: any;
  }>
): Promise<ProcessedAttachment[]> {
  return Promise.all(
    attachments.map(async (att) => {
      const data = await toArrayBuffer(att.content);

      return {
        filename: att.filename || 'unnamed',
        contentType: att.mimeType || 'application/octet-stream',
        data,
      };
    })
  );
}


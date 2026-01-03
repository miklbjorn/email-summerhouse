/**
 * R2 Storage utilities for medallion architecture
 * Bronze: Raw email and attachments
 * Silver: Processed markdown from attachments
 * Gold: Extracted structured data (JSON)
 */

import type { InvoiceExtraction } from './ai-processing';

export interface EmailMetadata {
  messageId: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
}

export interface BronzeLayerData {
  email: {
    raw: ArrayBuffer;
    metadata: EmailMetadata;
  };
  attachments: Array<{
    filename: string;
    contentType: string;
    data: ArrayBuffer;
  }>;
}

export interface SilverLayerData {
  messageId: string;
  markdownFiles: Array<{
    filename: string;
    content: string;
  }>;
}

export interface GoldLayerData {
  messageId: string;
  extractedData: InvoiceExtraction;
}

/**
 * Generate timestamp in ISO format with seconds (e.g., 2024-01-15T14:30:45Z)
 * URL-safe format for use in file paths
 */
export function generateTimestamp(): string {
  return new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5) + 'Z';
}

/**
 * Generate storage path for bronze layer
 * Format: bronze/timestamp/messageId/filename
 */
function getBronzePath(timestamp: string, messageId: string, filename: string): string {
  const sanitizedMessageId = messageId.replace(/[^a-zA-Z0-9]/g, '_');
  return `bronze/${timestamp}/${sanitizedMessageId}/${filename}`;
}

/**
 * Generate storage path for silver layer
 * Format: silver/timestamp/messageId/filename.md
 */
function getSilverPath(timestamp: string, messageId: string, filename: string): string {
  const sanitizedMessageId = messageId.replace(/[^a-zA-Z0-9]/g, '_');
  const sanitizedFilename = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  return `silver/${timestamp}/${sanitizedMessageId}/${sanitizedFilename}.md`;
}

/**
 * Generate storage path for gold layer
 * Format: gold/timestamp/messageId/extracted.json
 */
function getGoldPath(timestamp: string, messageId: string): string {
  const sanitizedMessageId = messageId.replace(/[^a-zA-Z0-9]/g, '_');
  return `gold/${timestamp}/${sanitizedMessageId}/extracted.json`;
}

/**
 * Persist email and attachments to bronze layer
 */
export async function persistToBronzeLayer(
  r2: R2Bucket,
  data: BronzeLayerData,
  timestamp: string
): Promise<string[]> {
  const paths: string[] = [];
  const messageId = data.email.metadata.messageId;

  // Store raw email
  const emailPath = getBronzePath(timestamp, messageId, 'email.raw');
  await r2.put(emailPath, data.email.raw);
  paths.push(emailPath);

  // Store email metadata as JSON
  const metadataPath = getBronzePath(timestamp, messageId, 'metadata.json');
  await r2.put(
    metadataPath,
    JSON.stringify(data.email.metadata, null, 2),
    {
      httpMetadata: { contentType: 'application/json' },
    }
  );
  paths.push(metadataPath);

  // Store each attachment
  for (const attachment of data.attachments) {
    const attachmentPath = getBronzePath(timestamp, messageId, attachment.filename);
    await r2.put(attachmentPath, attachment.data, {
      httpMetadata: { contentType: attachment.contentType },
    });
    paths.push(attachmentPath);
  }

  return paths;
}

/**
 * Persist markdown content to silver layer
 * Persists each markdown file individually
 */
export async function persistToSilverLayer(
  r2: R2Bucket,
  data: SilverLayerData,
  timestamp: string
): Promise<string[]> {
  const paths: string[] = [];
  
  for (const file of data.markdownFiles) {
    const path = getSilverPath(timestamp, data.messageId, file.filename);
    await r2.put(path, file.content, {
      httpMetadata: { contentType: 'text/markdown' },
    });
    paths.push(path);
  }
  
  return paths;
}

/**
 * Persist extracted data to gold layer
 */
export async function persistToGoldLayer(
  r2: R2Bucket,
  data: GoldLayerData,
  timestamp: string
): Promise<string> {
  const path = getGoldPath(timestamp, data.messageId);
  await r2.put(
    path,
    JSON.stringify(data.extractedData, null, 2),
    {
      httpMetadata: { contentType: 'application/json' },
    }
  );
  return path;
}


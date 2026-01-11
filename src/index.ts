/**
 * Cloudflare Email Worker for Invoice Processing
 * 
 * Flow:
 * 1. Validate email sender
 * 2. Persist email and attachments to R2 (bronze layer)
 * 3. Convert attachments to markdown using AI (silver layer)
 * 4. Extract invoice info using LLM (gold layer + D1 database)
 * 5. Send reply email with summary
 */

import * as PostalMime from 'postal-mime';
import {
  getAllowedSenders,
  extractMessageId,
  extractEmailAddresses,
  processAttachments,
} from './utils/email';
import {
  persistToBronzeLayer,
  persistToSilverLayer,
  persistToGoldLayer,
  generateTimestamp,
  type BronzeLayerData,
  type SilverLayerData,
  type GoldLayerData,
} from './utils/storage';
import {
  processEmailAndAttachmentsToMarkdown,
  extractInvoiceInfo,
} from './utils/ai-processing';
import {
  initializeDatabase,
  insertInvoice,
} from './utils/database';
import { generateReplyEmail, generateErrorReplyEmail } from './utils/email-replies';
import { getAllInvoices, getInvoiceById, updateInvoice, deleteInvoice, type InvoiceUpdateRequest } from './api/invoices';
import { serveFileFromR2 } from './api/files';
import { verifyAccessJWT } from './utils/auth';

export default {
  async email(
    message: ForwardableEmailMessage,
    env: any,
    ctx: ExecutionContext
  ) {
    
    // Parse email once, outside the try-catch so we can use fromAddress in error handler
    const parser = new PostalMime.default();
    const rawEmail = new Response(message.raw);
    const rawEmailBuffer = await rawEmail.arrayBuffer();
    const email = await parser.parse(rawEmailBuffer);
    const parser2 = new PostalMime.default();

    const email2 = await parser2.parse(rawEmailBuffer);
    const messageId = extractMessageId(email, message.headers);
    const fromAddress = email.from?.address ?? "<from-address-missing>";
    
    let replyMessage: EmailMessage | null = null; 

    try {
      // Step 1: Check that the email is sent from an allowed email address
      const allowedSenders = getAllowedSenders(env);

      if (!allowedSenders.includes(fromAddress)) {
        console.log({
          message: `Blocked email from unauthorized sender. Sender ${fromAddress}, not in allowed list: ${allowedSenders.join(', ')}.`,
          email: email,
        });
        message.setReject('Unauthorized sender');
        return;
      }

      console.log({
        message: 'Processing invoice email',
        messageId,
        fromAddress,
        subject: email.subject,
      });

      // Step 2: Persist email contents and all attachments in storage (bronze layer)
      // Generate a single timestamp for all medallion layers for this email
      const timestamp = generateTimestamp();

      const attachments = email.attachments || [];
      const attachmentData = await processAttachments(attachments);

      const bronzeData: BronzeLayerData = {
        email: {
          raw: rawEmailBuffer,
          metadata: {
            messageId,
            from: fromAddress || 'unknown',
            to: extractEmailAddresses(email.to),
            subject: email.subject || 'No subject',
            date: email.date || new Date().toISOString(),
          },
        },
        attachments: attachmentData,
      };
      
      console.log('Persisting to bronze layer:', bronzeData);
      const bronzePaths = await persistToBronzeLayer(env.R2, bronzeData, timestamp);
      console.log('Persisted to bronze layer:', bronzePaths);

      // Step 3: Extract all info from attachments and email body into markdown format (silver layer)
      // Process email body and attachments together in a single batch call
      const markdownFiles = await processEmailAndAttachmentsToMarkdown(
        env.AI,
        email.text,
        email.html,
        attachmentData
      );

      // Persist each markdown file individually to silver layer
      const silverData: SilverLayerData = {
        messageId,
        markdownFiles,
      };

      console.log('Persisting to silver layer:', silverData);

      const silverPaths = await persistToSilverLayer(env.R2, silverData, timestamp);
      console.log('Persisted to silver layer:', silverPaths);

      // Step 4: Have an LLM extract key info and persist to gold layer + D1 database
      // Pass individual markdown files - extraction function will concatenate as needed
      const extraction = await extractInvoiceInfo(env.AI, markdownFiles);

      const goldData: GoldLayerData = {
        messageId,
        extractedData: extraction,
      };

      console.log('Persisting to gold layer:', goldData);
      const goldPath = await persistToGoldLayer(env.R2, goldData, timestamp);
      console.log('Persisted to gold layer:', goldPath);

      // Initialize database if needed and insert invoice
      await initializeDatabase(env.DB);
      
      // Map markdown files to their bronze layer blob URIs
      // Filter out email-body as it's not a source file attachment
      // Match attachment filenames to their bronze paths
      const sourceFiles = markdownFiles
        .filter((file) => file.filename !== 'email-body')
        .map((file) => {
          // Find the bronze path that matches this filename
          const blobUri = bronzePaths.find((path) => path.endsWith(`/${file.filename}`));
          return {
            filename: file.filename,
            blob_uri: blobUri || '', // Use empty string if not found (shouldn't happen)
          };
        });
      
      await insertInvoice(env.DB, messageId, extraction, sourceFiles);
      console.log('Inserted invoice into D1 database');

      // Step 5: Send reply email with key info summarized
      const originalMessageId = message.headers.get('Message-ID');
      replyMessage = generateReplyEmail(
        originalMessageId,
        fromAddress || 'unknown',
        extraction
      );

      console.log({
        message: 'Invoice processing completed successfully',
        messageId,
        extraction,
      });
    } catch (error) {
      console.error('Error processing invoice email:', error);
      
      // Try to send an error reply using already-parsed email data
      try {
        const originalMessageId = message.headers.get('Message-ID');
        const errorMsg = error instanceof Error ? error.message : String(error);
        replyMessage = generateErrorReplyEmail(
          originalMessageId,
          fromAddress,
          errorMsg
        );
      } catch (replyError) {
        console.error('Failed to construct a reply message:', replyError);
      }

      // Re-throw to mark email as failed
      throw error;
    } finally {
      // Send reply if we have a replyMessage constructed
      if (replyMessage) {
        try {
          await message.reply(replyMessage);
          console.log('Sent reply email to:', fromAddress);
        } catch (sendError) {
          console.error('Failed to send reply email:', sendError);
        }
      } else {
        console.warn('No reply message constructed; skipping reply email.');
      }
    }
  },

  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // API routes
    if (path.startsWith('/api/')) {
      return handleApiRequest(request, env, path, url);
    }

    // Static assets handled by wrangler assets binding
    return new Response('Not found', { status: 404 });
  },
};

async function handleApiRequest(
  request: Request,
  env: any,
  path: string,
  url: URL
): Promise<Response> {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Cf-Access-Jwt-Assertion',
    'Content-Type': 'application/json',
  };

  // Handle CORS preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Verify Cloudflare Access JWT (skip in development)
  const isDev = env.ENVIRONMENT === 'development';
  const authResult = await verifyAccessJWT(request, env.CF_ACCESS_TEAM_NAME);
  if (!isDev && !authResult.authenticated) {
    console.warn('Authentication failed miserably:', authResult.error);
    return new Response(JSON.stringify({ error: 'Unauthorized', details: authResult.error }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  try {
    // Ensure database is initialized
    await initializeDatabase(env.DB);

    // GET /api/invoices - List all invoices
    if (path === '/api/invoices' && request.method === 'GET') {
      const unpaidOnly = url.searchParams.get('unpaidOnly') === 'true';
      const limit = url.searchParams.get('limit');
      const offset = url.searchParams.get('offset');

      const invoices = await getAllInvoices(env.DB, {
        unpaidOnly,
        limit: limit ? parseInt(limit) : undefined,
        offset: offset ? parseInt(offset) : undefined,
      });

      return new Response(JSON.stringify(invoices), { headers: corsHeaders });
    }

    // GET /api/invoices/:id - Get single invoice
    const invoiceMatch = path.match(/^\/api\/invoices\/(\d+)$/);
    if (invoiceMatch && request.method === 'GET') {
      const invoice = await getInvoiceById(env.DB, parseInt(invoiceMatch[1]));
      if (!invoice) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify(invoice), { headers: corsHeaders });
    }

    // PATCH /api/invoices/:id - Update invoice fields
    if (invoiceMatch && request.method === 'PATCH') {
      const body = await request.json() as InvoiceUpdateRequest & { paid?: boolean };

      // Handle legacy { paid: true } format for backwards compatibility
      if (body.paid === true && !body.status) {
        body.status = 'paid';
      }

      // Remove the legacy paid field before passing to updateInvoice
      const { paid, ...updates } = body as InvoiceUpdateRequest & { paid?: boolean };

      const updatedInvoice = await updateInvoice(env.DB, parseInt(invoiceMatch[1]), updates);
      if (!updatedInvoice) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify(updatedInvoice), { headers: corsHeaders });
    }

    // DELETE /api/invoices/:id - Delete invoice
    if (invoiceMatch && request.method === 'DELETE') {
      const success = await deleteInvoice(env.DB, parseInt(invoiceMatch[1]));
      if (!success) {
        return new Response(JSON.stringify({ error: 'Not found' }), {
          status: 404,
          headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // GET /api/files/* - Serve files from R2
    if (path.startsWith('/api/files/') && request.method === 'GET') {
      const filePath = decodeURIComponent(path.replace('/api/files/', ''));
      return serveFileFromR2(env.R2, filePath);
    }

    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders,
    });
  } catch (error) {
    console.error('API error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}
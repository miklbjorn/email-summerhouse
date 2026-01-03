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
import { generateReplyEmail } from './utils/emailReply';

export default {
  async email(
    message: ForwardableEmailMessage,
    env: any,
    ctx: ExecutionContext
  ) {
    try {

      const parser = new PostalMime.default();
      const rawEmail = new Response(message.raw);
      const rawEmailBuffer = await rawEmail.arrayBuffer();
      const email = await parser.parse(rawEmailBuffer);
      const messageId = extractMessageId(email, message.headers);

      // Step 1: Check that the email is sent from an allowed email address
      const allowedSenders = getAllowedSenders(env);
      const fromAddress = email.from?.address ?? "<from-address-missing>";

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

      const silverPaths = await persistToSilverLayer(env.R2, silverData, timestamp);
      console.log('Persisted to silver layer:', silverPaths);

      // Step 4: Have an LLM extract key info and persist to gold layer + D1 database
      // Pass individual markdown files - extraction function will concatenate as needed
      const extraction = await extractInvoiceInfo(env.AI, markdownFiles);

      const goldData: GoldLayerData = {
        messageId,
        extractedData: extraction,
      };

      const goldPath = await persistToGoldLayer(env.R2, goldData, timestamp);
      console.log('Persisted to gold layer:', goldPath);

      // Initialize database if needed and insert invoice
      try {
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
      } catch (dbError) {
        console.error('Database error:', dbError);
        // Continue even if database insert fails
      }

      // Step 5: Send reply email with key info summarized
      const originalMessageId = message.headers.get('Message-ID');
      const replyMessage = generateReplyEmail(
        originalMessageId,
        fromAddress || 'unknown',
        extraction
      );

      await message.reply(replyMessage);
      console.log('Sent reply email');

      console.log({
        message: 'Invoice processing completed successfully',
        messageId,
        extraction,
      });
    } catch (error) {
      console.error('Error processing invoice email:', error);
      
      // Try to send an error reply
      try {
        const parser = new PostalMime.default();
        const rawEmail = new Response(message.raw);
        const email = await parser.parse(await rawEmail.arrayBuffer());
        const fromAddress = email.from?.address;

        if (fromAddress) {
          const originalMessageId = message.headers.get('Message-ID');
          const errorReply = generateReplyEmail(
            originalMessageId,
            fromAddress,
            {
              items: [],
              supplier: 'Error',
              amount: null,
              invoiceId: 'Error',
              accountIBAN: null,
              accountBIC: null,
              accountREG: null,
              accountNumber: null,
              lastPaymentDate: null,
              sourceFileReference: 'N/A',
            }
          );
          await message.reply(errorReply);
        }
      } catch (replyError) {
        console.error('Failed to send error reply:', replyError);
      }

      // Re-throw to mark email as failed
      throw error;
    }
  },
};

export async function fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
  return new Response('Email Worker - Invoice Processing System');
}
/**
 * AI processing utilities
 * - Convert attachments to markdown using Cloudflare AI toMarkdown
 * - Extract structured data using LLM
 */

import type { SilverLayerData, GoldLayerData } from './storage';

export interface InvoiceExtraction {
  items: string[];
  supplier: string | null;
  amount: number | null;
  currency: string | null;
  invoiceId: string | null;
  accountIBAN: string | null;
  accountBIC: string | null;
  accountREG: string | null;
  accountNumber: string | null;
  lastPaymentDate: string | null;
  sourceFileReference: string | null;
}

export interface CloudflareAI {
  toMarkdown(
    files: MarkdownDocument | MarkdownDocument[]
  ): Promise<ConversionResult | ConversionResult[]>;
  run(model: string, input: any): Promise<any>;
}

export interface MarkdownDocument {
  name: string;
  blob: Blob;
}

export interface ConversionResult {
  name: string;
  format: 'markdown' | 'error';
  mimetype: string;
  tokens?: number;
  data?: string;
  error?: string;
}

/**
 * Process email body and attachments to markdown using Cloudflare AI toMarkdown
 * Forms an array with all documents (email body + attachments) as blobs,
 * then calls toMarkdown once with the entire array
 */
export async function processEmailAndAttachmentsToMarkdown(
  ai: CloudflareAI,
  emailText?: string,
  emailHtml?: string,
  attachments: Array<{
    filename: string;
    contentType: string;
    data: ArrayBuffer;
  }> = []
): Promise<Array<{ filename: string; content: string }>> {
  const markdownDocuments: MarkdownDocument[] = [];

  // Add email body if available (prefer HTML over text)
  if (emailHtml || emailText) {
    const content = emailHtml || emailText || '';
    const contentType = emailHtml ? 'text/html' : 'text/plain';
    
    if (content) {
      // Convert string to ArrayBuffer
      const encoder = new TextEncoder();
      const encoded = encoder.encode(content);
      const contentBuffer = new ArrayBuffer(encoded.length);
      new Uint8Array(contentBuffer).set(encoded);

      markdownDocuments.push({
        name: 'email-body',
        blob: new Blob([contentBuffer], { type: contentType }),
      });
    }
  }

  // Add all attachments
  for (const attachment of attachments) {
    markdownDocuments.push({
      name: attachment.filename,
      blob: new Blob([attachment.data], { type: attachment.contentType }),
    });
  }

  // If no documents to process, return empty array
  if (markdownDocuments.length === 0) {
    return [];
  }

  try {
    // Call toMarkdown once with all documents
    const results = await ai.toMarkdown(markdownDocuments);
    const resultArray = Array.isArray(results) ? results : [results];

    return resultArray.map((result) => {
      if (result.format === 'error') {
        console.error(
          `Error converting ${result.name} to markdown:`,
          result.error
        );
        return {
          filename: result.name,
          content: `# ${result.name}\n\n[Conversion error: ${result.error}]`,
        };
      }

      return {
        filename: result.name,
        content: result.data || '',
      };
    });
  } catch (error) {
    console.error('Error converting to markdown:', error);
    // Fallback: return error messages for all documents
    return markdownDocuments.map((doc) => ({
      filename: doc.name,
      content: `# ${doc.name}\n\n[AI conversion failed: ${error}]`,
    }));
  }
}

/**
 * Extract invoice information using LLM
 * Accepts multiple markdown contents and concatenates them internally
 */
export async function extractInvoiceInfo(
  ai: CloudflareAI,
  markdownContents: Array<{ filename: string; content: string }>
): Promise<InvoiceExtraction> {
  // Concatenate all markdown contents with clear separators
  const combinedContent = markdownContents
    .map((file) => `# ${file.filename}\n\n${file.content}\n\n`)
    .join('---\n\n');
  
  const sourceFiles = markdownContents.map((file) => file.filename);
  
  const prompt = `Extract the following information from this invoice document and return it as JSON:

Required fields (all can be null if not found):
- items: array of strings describing what items/services are covered (can be empty array)
- supplier: the name of the supplier/company that sent the invoice
- amount: the total amount to pay (as a number)
- currency: the currency code (e.g. "DKK", "SEK", "EUR", "USD")
- invoiceId: the invoice number or ID
- accountIBAN: the IBAN (International Bank Account Number) if available
- accountBIC: the BIC/SWIFT code for international accounts if available
- accountREG: the REG (registration number) for Danish accounts if available
- accountNumber: the account number (for Danish accounts or if IBAN not available)
- lastPaymentDate: the last payment date if mentioned, or null if not found
- sourceFileReference: reference to the source file (use the first filename from: ${sourceFiles.join(', ')})

Document content:
${combinedContent}

Return ONLY valid JSON in this exact format:
{
  "items": ["item1", "item2"],
  "supplier": "Supplier Name" or null,
  "amount": 1234.56 or null,
  "currency": "DKK" or null,
  "invoiceId": "INV-123" or null,
  "accountIBAN": "DK1234567890123456" or null,
  "accountBIC": "DABADKKK" or null,
  "accountREG": "1234" or null,
  "accountNumber": "1234567890" or null,
  "lastPaymentDate": "2024-01-15" or null,
  "sourceFileReference": "filename.pdf" or null
}`;

  try {
    const result = await ai.run('@cf/meta/llama-3.1-8b-instruct', {
      messages: [
        {
          role: 'system',
          content: 'You are a data extraction assistant. Extract structured information from invoices and return ONLY valid JSON, no additional text or explanation.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const responseText = result.response || result.text || JSON.stringify(result);
    
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const extracted = JSON.parse(jsonMatch[0]);
      return {
        items: extracted.items || [],
        supplier: extracted.supplier || null,
        amount: extracted.amount || null,
        currency: extracted.currency || null,
        invoiceId: extracted.invoiceId || null,
        accountIBAN: extracted.accountIBAN || null,
        accountBIC: extracted.accountBIC || null,
        accountREG: extracted.accountREG || null,
        accountNumber: extracted.accountNumber || null,
        lastPaymentDate: extracted.lastPaymentDate || null,
        sourceFileReference: extracted.sourceFileReference || sourceFiles[0] || null,
      };
    }

    throw new Error('No JSON found in AI response');
  } catch (error) {
    console.error('Error extracting invoice info:', error);
    // Return default structure on error
    return {
      items: [],
      supplier: null,
      amount: null,
      currency: null,
      invoiceId: null,
      accountIBAN: null,
      accountBIC: null,
      accountREG: null,
      accountNumber: null,
      lastPaymentDate: null,
      sourceFileReference: sourceFiles[0] || null,
    };
  }
}




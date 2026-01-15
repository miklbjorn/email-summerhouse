/**
 * Eval runner for invoice extraction
 *
 * Usage: npx tsx eval/run-eval.ts
 *
 * Requires:
 * - Dev server running on http://localhost:8787
 * - PDF files in eval/data/
 * - Ground truth in eval/eval_ground_truth.csv
 */

import * as fs from 'fs';
import * as path from 'path';

const API_URL = process.env.EVAL_API_URL || 'http://localhost:8788';
const EVAL_DIR = path.dirname(new URL(import.meta.url).pathname);
const DATA_DIR = path.join(EVAL_DIR, 'data');
const GROUND_TRUTH_PATH = path.join(EVAL_DIR, 'eval_ground_truth.csv');

interface GroundTruth {
  filename: string;
  supplier: string | null;
  invoiceId: string | null;
  amount: number | null;
  accountIBAN: string | null;
  accountBIC: string | null;
  accountREG: string | null;
  accountNumber: string | null;
  lastPaymentDate: string | null;
  currency: string | null;
  accountBalance: number | null;
  status: string | null;
}

interface ExtractionResult {
  supplier: string | null;
  invoiceId: string | null;
  amount: number | null;
  accountIBAN: string | null;
  accountBIC: string | null;
  accountREG: string | null;
  accountNumber: string | null;
  lastPaymentDate: string | null;
  currency: string | null;
  accountBalance: number | null;
}

interface FieldComparison {
  field: string;
  expected: string | number | null;
  actual: string | number | null;
  match: boolean;
}

interface EvalResult {
  filename: string;
  success: boolean;
  error?: string;
  comparisons: FieldComparison[];
  matchCount: number;
  totalFields: number;
}

function parseCSV(content: string): GroundTruth[] {
  const lines = content.trim().split('\n');
  const header = lines[0];

  // Skip header row
  return lines.slice(1).map((line) => {
    const values = line.split(';');
    return {
      filename: values[0]?.trim() || '',
      supplier: values[1]?.trim() || null,
      invoiceId: values[2]?.trim() || null,
      amount: parseNumber(values[3]),
      accountIBAN: values[4]?.trim() || null,
      accountBIC: values[5]?.trim() || null,
      accountREG: values[6]?.trim() || null,
      accountNumber: values[7]?.trim() || null,
      lastPaymentDate: values[8]?.trim() || null,
      currency: values[9]?.trim() || null,
      accountBalance: parseNumber(values[10]),
      status: values[11]?.trim() || null,
    };
  });
}

function parseNumber(value: string | undefined): number | null {
  if (!value || value.trim() === '') return null;
  // Handle European decimal format (comma as decimal separator)
  const normalized = value.trim().replace(',', '.');
  const num = parseFloat(normalized);
  return isNaN(num) ? null : num;
}

function normalizeString(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return null;
  return value.trim().toLowerCase();
}

function normalizeIBAN(value: string | null | undefined): string | null {
  if (!value) return null;
  // Remove spaces and "IBAN" prefix, lowercase
  return value.replace(/\s+/g, '').replace(/^IBAN\s*/i, '').toLowerCase();
}

function normalizeDate(value: string | null | undefined): string | null {
  if (!value) return null;
  // Try to parse various date formats and normalize to YYYY-MM-DD
  const trimmed = value.trim();

  // Handle DD/MM/YYYY format
  const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (ddmmyyyy) {
    const [, day, month, year] = ddmmyyyy;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Handle YYYY-MM-DD format (already normalized)
  const yyyymmdd = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (yyyymmdd) {
    return trimmed;
  }

  return trimmed.toLowerCase();
}

function compareField(
  field: string,
  expected: string | number | null,
  actual: string | number | null
): FieldComparison {
  let match = false;

  if (expected === null && actual === null) {
    match = true;
  } else if (expected === null || actual === null) {
    match = false;
  } else if (typeof expected === 'number' && typeof actual === 'number') {
    // Allow small floating point differences
    match = Math.abs(expected - actual) < 0.01;
  } else if (field === 'accountIBAN') {
    match = normalizeIBAN(String(expected)) === normalizeIBAN(String(actual));
  } else if (field === 'lastPaymentDate') {
    match = normalizeDate(String(expected)) === normalizeDate(String(actual));
  } else {
    match = normalizeString(String(expected)) === normalizeString(String(actual));
  }

  return { field, expected, actual, match };
}

async function extractFromPDF(
  filePath: string
): Promise<ExtractionResult> {
  const fileBuffer = fs.readFileSync(filePath);
  const filename = path.basename(filePath);

  const formData = new FormData();
  formData.append('file', new Blob([fileBuffer], { type: 'application/pdf' }), filename);

  const response = await fetch(`${API_URL}/api/extract`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Extraction failed: ${response.status} ${error}`);
  }

  const result = await response.json() as { extraction: ExtractionResult };
  return result.extraction;
}

function compareExtraction(
  groundTruth: GroundTruth,
  extraction: ExtractionResult
): FieldComparison[] {
  return [
    compareField('supplier', groundTruth.supplier, extraction.supplier),
    compareField('invoiceId', groundTruth.invoiceId, extraction.invoiceId),
    compareField('amount', groundTruth.amount, extraction.amount),
    compareField('accountIBAN', groundTruth.accountIBAN, extraction.accountIBAN),
    compareField('accountBIC', groundTruth.accountBIC, extraction.accountBIC),
    compareField('accountREG', groundTruth.accountREG, extraction.accountREG),
    compareField('accountNumber', groundTruth.accountNumber, extraction.accountNumber),
    compareField('lastPaymentDate', groundTruth.lastPaymentDate, extraction.lastPaymentDate),
    compareField('currency', groundTruth.currency, extraction.currency),
    compareField('accountBalance', groundTruth.accountBalance, extraction.accountBalance),
  ];
}

async function runEval(): Promise<void> {
  console.log('Invoice Extraction Evaluation');
  console.log('='.repeat(60));
  console.log(`API URL: ${API_URL}`);
  console.log(`Data directory: ${DATA_DIR}`);
  console.log(`Ground truth: ${GROUND_TRUTH_PATH}`);
  console.log('');

  // Check if ground truth exists
  if (!fs.existsSync(GROUND_TRUTH_PATH)) {
    console.error('Error: Ground truth file not found at', GROUND_TRUTH_PATH);
    process.exit(1);
  }

  // Parse ground truth
  const csvContent = fs.readFileSync(GROUND_TRUTH_PATH, 'utf-8');
  const groundTruths = parseCSV(csvContent);
  console.log(`Found ${groundTruths.length} test cases in ground truth\n`);

  const results: EvalResult[] = [];

  for (const groundTruth of groundTruths) {
    const pdfPath = path.join(DATA_DIR, groundTruth.filename);

    console.log(`Processing: ${groundTruth.filename}`);

    if (!fs.existsSync(pdfPath)) {
      console.log(`  ERROR: PDF file not found\n`);
      results.push({
        filename: groundTruth.filename,
        success: false,
        error: 'PDF file not found',
        comparisons: [],
        matchCount: 0,
        totalFields: 10,
      });
      continue;
    }

    try {
      const extraction = await extractFromPDF(pdfPath);
      const comparisons = compareExtraction(groundTruth, extraction);
      const matchCount = comparisons.filter((c) => c.match).length;

      results.push({
        filename: groundTruth.filename,
        success: true,
        comparisons,
        matchCount,
        totalFields: comparisons.length,
      });

      console.log(`  Score: ${matchCount}/${comparisons.length} fields correct`);

      // Show mismatches
      const mismatches = comparisons.filter((c) => !c.match);
      if (mismatches.length > 0) {
        console.log('  Mismatches:');
        for (const m of mismatches) {
          console.log(`    - ${m.field}: expected "${m.expected}", got "${m.actual}"`);
        }
      }
      console.log('');
    } catch (error) {
      console.log(`  ERROR: ${error instanceof Error ? error.message : String(error)}\n`);
      results.push({
        filename: groundTruth.filename,
        success: false,
        error: error instanceof Error ? error.message : String(error),
        comparisons: [],
        matchCount: 0,
        totalFields: 10,
      });
    }
  }

  // Print summary
  console.log('='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));

  const successfulResults = results.filter((r) => r.success);
  const totalFields = successfulResults.reduce((sum, r) => sum + r.totalFields, 0);
  const totalMatches = successfulResults.reduce((sum, r) => sum + r.matchCount, 0);

  console.log(`Files processed: ${results.length}`);
  console.log(`Successful extractions: ${successfulResults.length}`);
  console.log(`Failed extractions: ${results.length - successfulResults.length}`);

  if (totalFields > 0) {
    const accuracy = ((totalMatches / totalFields) * 100).toFixed(1);
    console.log(`Overall field accuracy: ${totalMatches}/${totalFields} (${accuracy}%)`);
  }

  // Per-field accuracy breakdown
  if (successfulResults.length > 0) {
    console.log('\nPer-field accuracy:');
    const fieldNames = [
      'supplier',
      'invoiceId',
      'amount',
      'accountIBAN',
      'accountBIC',
      'accountREG',
      'accountNumber',
      'lastPaymentDate',
      'currency',
      'accountBalance',
    ];

    for (const fieldName of fieldNames) {
      const fieldResults = successfulResults.flatMap((r) =>
        r.comparisons.filter((c) => c.field === fieldName)
      );
      const matches = fieldResults.filter((c) => c.match).length;
      const total = fieldResults.length;
      if (total > 0) {
        const pct = ((matches / total) * 100).toFixed(0);
        console.log(`  ${fieldName.padEnd(16)}: ${matches}/${total} (${pct}%)`);
      }
    }
  }

  // Exit with error code if there were failures
  const failedCount = results.length - successfulResults.length;
  if (failedCount > 0) {
    process.exit(1);
  }
}

runEval().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

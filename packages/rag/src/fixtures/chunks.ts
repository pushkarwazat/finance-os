import { randomUUID } from "node:crypto";
import type { Chunk } from "../chunks/schema.js";
import {
  FIXTURE_CLOSE_MEMO,
  FIXTURE_BOARD_DECK,
  FIXTURE_POLICY,
  FIXTURE_CONTRACT,
  FIXTURE_INVOICE,
  FIXTURE_AUDIT_WORKPAPER,
  FIXTURE_SOP,
} from "./documents.js";

const NOW = "2025-10-01T09:00:00.000Z";
const TENANT = "tenant-demo-001";

function chunk(
  documentId: string,
  index: number,
  contentType: Chunk["contentType"],
  sectionTitle: string,
  text: string,
  pageNumber: number,
  extra: Partial<Chunk> = {}
): Chunk {
  return {
    chunkId: randomUUID(),
    documentId,
    tenantId: TENANT,
    chunkIndex: index,
    contentType,
    sectionTitle,
    sectionPath: [sectionTitle],
    chunkText: text,
    tokenCount: Math.ceil(text.length / 4),
    pageNumber,
    metadataTags: [],
    sensitivityLevel: "internal",
    sensitivityTags: [],
    entities: [],
    relationships: [],
    createdAt: NOW,
    updatedAt: NOW,
    schemaVersion: "rag.financeos.io/v1",
    ...extra,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Close memo chunks
// ─────────────────────────────────────────────────────────────────────────────

export const CLOSE_MEMO_CHUNKS: Chunk[] = [
  chunk(
    FIXTURE_CLOSE_MEMO.id, 0, "narrative", "Executive Summary",
    "Q3 FY2025 close has been completed. Total revenue for the quarter was $48.3M representing 18% year-over-year growth. ARR ended the period at $195M. Gross margin improved to 74.2% from 71.8% in Q3 FY2024.",
    1,
    { sensitivityLevel: "confidential", sensitivityTags: ["CONFIDENTIAL", "MNPI"], metadataTags: ["revenue", "q3-fy2025", "arr", "gross-margin"] }
  ),
  chunk(
    FIXTURE_CLOSE_MEMO.id, 1, "table", "Revenue Summary Table",
    "| Metric | Q3 FY2025 | Q3 FY2024 | Change |\n|--------|-----------|-----------|--------|\n| Revenue | $48.3M | $41.0M | +18% |\n| ARR | $195M | $165M | +18% |\n| NRR | 118% | 114% | +400bps |\n| Gross Margin | 74.2% | 71.8% | +240bps |",
    2,
    {
      sensitivityLevel: "confidential", sensitivityTags: ["CONFIDENTIAL", "MNPI"],
      metadataTags: ["revenue", "arr", "nrr", "gross-margin", "table", "q3-fy2025"],
      tableReference: {
        tableLabel: "Revenue Summary Table",
        headers: ["Metric", "Q3 FY2025", "Q3 FY2024", "Change"],
        rowCount: 4,
        markdownTable: "| Metric | Q3 FY2025 | Q3 FY2024 | Change |\n|--------|-----------|-----------|--------|\n| Revenue | $48.3M | $41.0M | +18% |\n| ARR | $195M | $165M | +18% |\n| NRR | 118% | 114% | +400bps |\n| Gross Margin | 74.2% | 71.8% | +240bps |",
        hasFinancialData: true,
        currencies: ["USD"],
      }
    }
  ),
  chunk(
    FIXTURE_CLOSE_MEMO.id, 2, "narrative", "Adjustments & Issues",
    "Key issues identified during close: (1) FX headwind of $1.2M impacted international segment revenue. Recorded as an FX translation adjustment to AOCI. (2) Professional services accrual of $340K posted to 2100-ACCRUED following review of open SOWs.",
    4,
    { sensitivityLevel: "confidential", sensitivityTags: ["CONFIDENTIAL"], metadataTags: ["adjustments", "fx", "accruals", "q3-fy2025"] }
  ),
  chunk(
    FIXTURE_CLOSE_MEMO.id, 3, "narrative", "Deferred Revenue",
    "Deferred revenue balance at Q3 FY2025 period end was $62.4M, up from $54.1M at Q3 FY2024. The increase reflects strong billings performance of $52.1M. Deferred revenue roll-forward has been reviewed and approved by the Controller.",
    5,
    { sensitivityLevel: "confidential", sensitivityTags: ["CONFIDENTIAL"], metadataTags: ["deferred-revenue", "billings", "q3-fy2025"] }
  ),
  chunk(
    FIXTURE_CLOSE_MEMO.id, 4, "table", "Operating Expense Summary",
    "| Category | Q3 FY2025 | Q3 FY2024 | Δ% |\n|----------|-----------|-----------|----|\n| R&D | $14.2M | $12.8M | +11% |\n| Sales & Marketing | $16.4M | $14.1M | +16% |\n| G&A | $7.5M | $6.2M | +21% |\n| Total OpEx | $38.1M | $33.1M | +15% |",
    6,
    {
      sensitivityLevel: "confidential", sensitivityTags: ["CONFIDENTIAL", "MNPI"],
      metadataTags: ["opex", "r&d", "sales", "g&a", "table", "q3-fy2025"],
      tableReference: {
        tableLabel: "Operating Expense Summary",
        headers: ["Category", "Q3 FY2025", "Q3 FY2024", "Δ%"],
        rowCount: 4,
        markdownTable: "| Category | Q3 FY2025 | Q3 FY2024 | Δ% |\n|----------|-----------|-----------|----|\n| R&D | $14.2M | $12.8M | +11% |\n| Sales & Marketing | $16.4M | $14.1M | +16% |\n| G&A | $7.5M | $6.2M | +21% |\n| Total OpEx | $38.1M | $33.1M | +15% |",
        hasFinancialData: true,
        currencies: ["USD"],
      }
    }
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// Board deck chunks
// ─────────────────────────────────────────────────────────────────────────────

export const BOARD_DECK_CHUNKS: Chunk[] = [
  chunk(
    FIXTURE_BOARD_DECK.id, 0, "narrative", "CEO Business Update",
    "Q3 FY2025 was a strong quarter driven by enterprise expansion. We added 24 new logos including 3 Fortune 500 accounts. Net Revenue Retention of 118% reflects strong upsell motion. Pipeline entering Q4 is at a record $82M.",
    3,
    { sensitivityLevel: "restricted", sensitivityTags: ["RESTRICTED", "MNPI", "BOARD_ONLY"], metadataTags: ["pipeline", "nrr", "logos", "q3-fy2025"] }
  ),
  chunk(
    FIXTURE_BOARD_DECK.id, 1, "table", "ARR Waterfall",
    "| Category | Amount |\n|----------|--------|\n| Opening ARR (Q2 FY2025) | $182M |\n| New Business | +$8.4M |\n| Expansion | +$6.2M |\n| Contraction | -$0.8M |\n| Churn | -$0.8M |\n| Closing ARR (Q3 FY2025) | $195M |",
    8,
    {
      sensitivityLevel: "restricted", sensitivityTags: ["RESTRICTED", "MNPI", "BOARD_ONLY"],
      metadataTags: ["arr", "waterfall", "churn", "expansion", "table", "q3-fy2025"],
      tableReference: {
        tableLabel: "ARR Waterfall",
        headers: ["Category", "Amount"],
        rowCount: 6,
        markdownTable: "| Category | Amount |\n|----------|--------|\n| Opening ARR (Q2 FY2025) | $182M |\n| New Business | +$8.4M |\n| Expansion | +$6.2M |\n| Contraction | -$0.8M |\n| Churn | -$0.8M |\n| Closing ARR (Q3 FY2025) | $195M |",
        hasFinancialData: true,
        currencies: ["USD"],
      }
    }
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// Policy document chunks
// ─────────────────────────────────────────────────────────────────────────────

export const POLICY_CHUNKS: Chunk[] = [
  chunk(
    FIXTURE_POLICY.id, 0, "narrative", "Scope and Applicability",
    "This policy applies to all revenue-generating contracts entered into by FinanceOS Inc. under ASC 606 (Topic 606) and IFRS 15. Revenue is recognised when (or as) performance obligations are satisfied. The five-step model governs all recognition decisions.",
    1,
    { sensitivityLevel: "internal", metadataTags: ["asc606", "revenue", "policy"] }
  ),
  chunk(
    FIXTURE_POLICY.id, 1, "narrative", "SaaS Subscription Revenue",
    "Subscription revenue is recognised ratably over the contract term, beginning on the date the customer has access to the software. Variable consideration (discounts, credits, refunds) is constrained to the amount for which a significant reversal is not probable.",
    3,
    { sensitivityLevel: "internal", metadataTags: ["saas", "subscription", "asc606", "revenue"] }
  ),
  chunk(
    FIXTURE_POLICY.id, 2, "narrative", "Contract Modifications",
    "Contract modifications are evaluated to determine whether they represent a new contract or a modification of an existing one. Modifications that add distinct goods or services at their standalone selling price are treated as new contracts. All other modifications are treated as modifications of the original contract.",
    5,
    { sensitivityLevel: "internal", metadataTags: ["modifications", "contracts", "asc606"] }
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// Contract chunks
// ─────────────────────────────────────────────────────────────────────────────

export const CONTRACT_CHUNKS: Chunk[] = [
  chunk(
    FIXTURE_CONTRACT.id, 0, "narrative", "Services and Scope",
    "FinanceOS Inc. agrees to provide Acme Software Ltd. with access to the FinanceOS platform including all standard modules: financial analytics, close management, document intelligence, and reporting. Support tier: Enterprise (24/7 response SLA).",
    2,
    { sensitivityLevel: "confidential", sensitivityTags: ["NDA", "CONFIDENTIAL"], metadataTags: ["msa", "services", "scope"] }
  ),
  chunk(
    FIXTURE_CONTRACT.id, 1, "narrative", "Payment Terms",
    "Acme Software Ltd. shall pay all invoices within thirty (30) days of invoice date. Late payments accrue interest at 1.5% per month. Annual contract value is $240,000 USD payable in equal monthly instalments of $20,000.",
    8,
    { sensitivityLevel: "confidential", sensitivityTags: ["NDA", "CONFIDENTIAL"], metadataTags: ["payment", "invoicing", "contract-value"] }
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// Audit workpaper chunks
// ─────────────────────────────────────────────────────────────────────────────

export const AUDIT_CHUNKS: Chunk[] = [
  chunk(
    FIXTURE_AUDIT_WORKPAPER.id, 0, "narrative", "Testing Scope",
    "This workpaper documents SOX ITGC testing for access control over key financial reporting systems: NetSuite ERP, FinanceOS analytics platform, and Salesforce CRM. Testing period: January 1 – September 30, 2025.",
    1,
    { sensitivityLevel: "restricted", sensitivityTags: ["RESTRICTED", "AUDIT_ONLY"], metadataTags: ["sox", "itgc", "access-control"] }
  ),
  chunk(
    FIXTURE_AUDIT_WORKPAPER.id, 1, "narrative", "Finding 1 — Shared Service Accounts",
    "Three shared service accounts were identified in the NetSuite ERP system, used by 3 users across Finance and IT. Shared accounts impair non-repudiation and are a deficiency under SOX ITGC. Risk rating: Medium. Management has agreed to remediate by December 31, 2025.",
    12,
    { sensitivityLevel: "restricted", sensitivityTags: ["RESTRICTED", "AUDIT_ONLY"], metadataTags: ["finding", "shared-accounts", "sox", "medium-risk"] }
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// SOP chunks
// ─────────────────────────────────────────────────────────────────────────────

export const SOP_CHUNKS: Chunk[] = [
  chunk(
    FIXTURE_SOP.id, 0, "narrative", "Step 1 — Extract Billing Data",
    "On the last business day of the month, the Revenue Accountant extracts the billing data from Stripe Billing into the revenue recognition workbook. Validate that all invoices match open opportunities in Salesforce CRM. Reconcile discrepancies before proceeding.",
    1,
    { sensitivityLevel: "internal", metadataTags: ["sop", "close", "revenue", "stripe"] }
  ),
  chunk(
    FIXTURE_SOP.id, 1, "narrative", "Step 4 — Journal Entry Approval",
    "All journal entries exceeding $100,000 require dual approval: Revenue Accountant prepares the entry, Controller reviews and approves in NetSuite. Entries must reference the supporting workbook and close memo document ID. Approval deadline: business day 5 of the following month.",
    4,
    { sensitivityLevel: "internal", metadataTags: ["sop", "journal-entry", "approval", "controls"] }
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// Invoice chunks
// ─────────────────────────────────────────────────────────────────────────────

export const INVOICE_CHUNKS: Chunk[] = [
  chunk(
    FIXTURE_INVOICE.id, 0, "table", "Invoice Line Items",
    "| Description | Amount |\n|-------------|--------|\n| EC2 Compute (m5.2xlarge × 40) | $41,280.00 |\n| RDS PostgreSQL (db.r5.large × 8) | $18,560.00 |\n| S3 Storage (48TB) | $11,040.00 |\n| CloudFront CDN | $8,920.45 |\n| Data Transfer Out | $4,520.00 |\n| **Total** | **$84,320.45** |",
    2,
    {
      sensitivityLevel: "internal", metadataTags: ["aws", "invoice", "cloud", "table"],
      tableReference: {
        tableLabel: "Invoice Line Items",
        headers: ["Description", "Amount"],
        rowCount: 5,
        markdownTable: "| Description | Amount |\n|-------------|--------|\n| EC2 Compute | $41,280.00 |\n| Total | $84,320.45 |",
        hasFinancialData: true,
        currencies: ["USD"],
      }
    }
  ),
];

// ─────────────────────────────────────────────────────────────────────────────
// All mock chunks combined
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_CHUNKS: Chunk[] = [
  ...CLOSE_MEMO_CHUNKS,
  ...BOARD_DECK_CHUNKS,
  ...POLICY_CHUNKS,
  ...CONTRACT_CHUNKS,
  ...AUDIT_CHUNKS,
  ...SOP_CHUNKS,
  ...INVOICE_CHUNKS,
];

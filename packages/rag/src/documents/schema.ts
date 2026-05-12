import { z } from "zod";

// ─────────────────────────────────────────────────────────────────────────────
// Sensitivity classification
// ─────────────────────────────────────────────────────────────────────────────

export const SensitivityLevelSchema = z.enum([
  "public",
  "internal",
  "confidential",
  "restricted",
]);
export type SensitivityLevel = z.infer<typeof SensitivityLevelSchema>;

export const SENSITIVITY_DESCRIPTIONS: Record<SensitivityLevel, string> = {
  public: "Safe for external distribution",
  internal: "Internal use only — not for external distribution",
  confidential: "Restricted to authorised personnel only",
  restricted: "Highest sensitivity — board/C-suite/legal access only",
};

// ─────────────────────────────────────────────────────────────────────────────
// Document type taxonomy
// ─────────────────────────────────────────────────────────────────────────────

export const DocumentTypeSchema = z.enum([
  "contract",
  "invoice",
  "policy_doc",
  "close_memo",
  "board_deck",
  "audit_workpaper",
  "sop",
  "spreadsheet",
]);
export type DocumentType = z.infer<typeof DocumentTypeSchema>;

export const DOCUMENT_TYPE_META: Record<
  DocumentType,
  { label: string; description: string; defaultSensitivity: SensitivityLevel }
> = {
  contract: {
    label: "Contract",
    description: "Legal agreements, MSAs, SOWs, NDAs, amendments",
    defaultSensitivity: "confidential",
  },
  invoice: {
    label: "Invoice",
    description: "Vendor invoices, purchase orders, payment receipts",
    defaultSensitivity: "internal",
  },
  policy_doc: {
    label: "Policy Document",
    description: "Corporate policies, procedures, compliance frameworks",
    defaultSensitivity: "internal",
  },
  close_memo: {
    label: "Close Memo",
    description: "Monthly/quarterly financial close commentary and sign-offs",
    defaultSensitivity: "confidential",
  },
  board_deck: {
    label: "Board Deck",
    description: "Board meeting materials, investor presentations",
    defaultSensitivity: "restricted",
  },
  audit_workpaper: {
    label: "Audit Workpaper",
    description: "Internal and external audit evidence and reconciliations",
    defaultSensitivity: "restricted",
  },
  sop: {
    label: "Standard Operating Procedure",
    description: "Step-by-step operational procedures and runbooks",
    defaultSensitivity: "internal",
  },
  spreadsheet: {
    label: "Spreadsheet",
    description: "Excel workbooks with financial data, GWP schedules, pharmacy margin tables",
    defaultSensitivity: "internal",
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// Document status lifecycle
// ─────────────────────────────────────────────────────────────────────────────

export const DocumentStatusSchema = z.enum([
  "pending",
  "parsing",
  "normalising",
  "classifying",
  "chunking",
  "embedding",
  "indexing",
  "enriching",
  "indexed",
  "error",
  "archived",
]);
export type DocumentStatus = z.infer<typeof DocumentStatusSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Base document schema — fields shared by all 7 types
// ─────────────────────────────────────────────────────────────────────────────

export const BaseDocumentSchema = z.object({
  /** Stable UUID assigned at upload time. */
  id: z.string().uuid(),
  type: DocumentTypeSchema,
  /** Human-readable title extracted from the document or assigned at upload. */
  title: z.string(),
  /** Original filename including extension. */
  filename: z.string(),
  /** MIME type of the source file. */
  mimeType: z.string(),
  /** File size in bytes. */
  sizeBytes: z.number().int().min(0),
  /** Current lifecycle status. */
  status: DocumentStatusSchema,
  /** ISO 8601 upload timestamp. */
  uploadedAt: z.string().datetime(),
  /** Uploader user ID or service account. */
  uploadedBy: z.string(),
  /** Tenant namespace this document belongs to. */
  tenantId: z.string(),
  /** Sensitivity classification. */
  sensitivityLevel: SensitivityLevelSchema,
  /** Free-form metadata tags for search and filtering. */
  tags: z.array(z.string()).default([]),
  /** Structured sensitivity tags (PII, NDA, MNPI, etc.). */
  sensitivityTags: z.array(z.string()).default([]),
  /** Fiscal year the document relates to (e.g. 2025). */
  fiscalYear: z.number().int().optional(),
  /** Fiscal period label (e.g. "Q3", "October", "H1"). */
  period: z.string().optional(),
  /** Total page count after parsing. */
  pageCount: z.number().int().min(0).optional(),
  /** Number of text chunks generated during ingestion. */
  chunkCount: z.number().int().min(0).default(0),
  /** LLM-generated or human-written summary of the document. */
  summary: z.string().optional(),
  /** Presigned URL or internal file reference. */
  sourceUrl: z.string().optional(),
  /** Ingestion job ID for tracking pipeline status. */
  ingestionJobId: z.string().uuid().optional(),
  /** Timestamp of last successful index update. */
  lastIndexedAt: z.string().datetime().optional(),
  /**
   * Graph-ready entity links.
   * Keys are entity types (e.g. "organization", "person", "metric").
   * Values are lists of string identifiers.
   */
  entityLinks: z.record(z.string(), z.array(z.string())).default({}),
  /** Schema version for forward-compatibility. */
  schemaVersion: z.string().default("rag.financeos.io/v1"),
});
export type BaseDocument = z.infer<typeof BaseDocumentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Contract
// ─────────────────────────────────────────────────────────────────────────────

export const ContractDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("contract"),
  contractType: z
    .enum(["msa", "sow", "nda", "amendment", "lease", "vendor", "customer", "other"])
    .optional(),
  counterparty: z.string().optional(),
  effectiveDate: z.string().optional(),
  expiryDate: z.string().optional(),
  autoRenews: z.boolean().optional(),
  totalContractValue: z.number().optional(),
  currency: z.string().default("USD"),
  governingLaw: z.string().optional(),
  signatories: z.array(z.string()).default([]),
  keyObligations: z.array(z.string()).default([]),
  renewalNoticeWindowDays: z.number().int().optional(),
});
export type ContractDocument = z.infer<typeof ContractDocumentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Invoice
// ─────────────────────────────────────────────────────────────────────────────

export const InvoiceDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("invoice"),
  invoiceNumber: z.string().optional(),
  vendorName: z.string().optional(),
  vendorId: z.string().optional(),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  amountTotal: z.number().optional(),
  amountDue: z.number().optional(),
  currency: z.string().default("USD"),
  poNumber: z.string().optional(),
  glCode: z.string().optional(),
  costCenter: z.string().optional(),
  approvedBy: z.string().optional(),
  paymentStatus: z.enum(["outstanding", "paid", "overdue", "disputed", "void"]).optional(),
  lineItems: z
    .array(
      z.object({
        description: z.string(),
        quantity: z.number().optional(),
        unitPrice: z.number().optional(),
        amount: z.number(),
        glCode: z.string().optional(),
      })
    )
    .default([]),
});
export type InvoiceDocument = z.infer<typeof InvoiceDocumentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Policy Document
// ─────────────────────────────────────────────────────────────────────────────

export const PolicyDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("policy_doc"),
  policyId: z.string().optional(),
  policyOwner: z.string().optional(),
  effectiveDate: z.string().optional(),
  reviewDate: z.string().optional(),
  version: z.string().optional(),
  complianceFrameworks: z.array(z.string()).default([]),
  applicableDepartments: z.array(z.string()).default([]),
  approvalChain: z.array(z.string()).default([]),
  supersededBy: z.string().uuid().optional(),
  supersedes: z.string().uuid().optional(),
});
export type PolicyDocument = z.infer<typeof PolicyDocumentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Close Memo
// ─────────────────────────────────────────────────────────────────────────────

export const CloseMemoDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("close_memo"),
  closeType: z.enum(["monthly", "quarterly", "annual", "special"]).optional(),
  preparedBy: z.string().optional(),
  reviewedBy: z.array(z.string()).default([]),
  signedOffBy: z.string().optional(),
  signOffDate: z.string().optional(),
  reportingCurrency: z.string().default("USD"),
  keyIssues: z.array(z.string()).default([]),
  adjustments: z
    .array(
      z.object({
        description: z.string(),
        amount: z.number(),
        glAccount: z.string().optional(),
      })
    )
    .default([]),
  materiality: z.number().optional(),
});
export type CloseMemoDocument = z.infer<typeof CloseMemoDocumentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Board Deck
// ─────────────────────────────────────────────────────────────────────────────

export const BoardDeckDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("board_deck"),
  meetingDate: z.string().optional(),
  boardMeetingType: z
    .enum(["regular", "special", "annual", "compensation", "audit"])
    .optional(),
  presentedBy: z.array(z.string()).default([]),
  attendees: z.array(z.string()).default([]),
  agendaItems: z.array(z.string()).default([]),
  resolutions: z.array(z.string()).default([]),
  mnpiPresent: z.boolean().default(false),
});
export type BoardDeckDocument = z.infer<typeof BoardDeckDocumentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Audit Workpaper
// ─────────────────────────────────────────────────────────────────────────────

export const AuditWorkpaperDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("audit_workpaper"),
  auditType: z
    .enum(["internal", "external", "sox", "it_general_controls", "special"])
    .optional(),
  auditFirm: z.string().optional(),
  auditorName: z.string().optional(),
  workpaperRef: z.string().optional(),
  controlId: z.string().optional(),
  riskRating: z.enum(["high", "medium", "low", "informational"]).optional(),
  findings: z.array(z.string()).default([]),
  recommendations: z.array(z.string()).default([]),
  managementResponse: z.string().optional(),
  remediationDeadline: z.string().optional(),
  remediationStatus: z
    .enum(["open", "in_progress", "closed", "accepted"])
    .optional(),
});
export type AuditWorkpaperDocument = z.infer<typeof AuditWorkpaperDocumentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// SOP
// ─────────────────────────────────────────────────────────────────────────────

export const SOPDocumentSchema = BaseDocumentSchema.extend({
  type: z.literal("sop"),
  sopId: z.string().optional(),
  process: z.string().optional(),
  department: z.string().optional(),
  processOwner: z.string().optional(),
  version: z.string().optional(),
  effectiveDate: z.string().optional(),
  reviewFrequencyDays: z.number().int().optional(),
  systemsInvolved: z.array(z.string()).default([]),
  roles: z.array(z.string()).default([]),
  controlPoints: z.array(z.string()).default([]),
});
export type SOPDocument = z.infer<typeof SOPDocumentSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Discriminated union of all document types
// ─────────────────────────────────────────────────────────────────────────────

export const FinanceDocumentSchema = z.discriminatedUnion("type", [
  ContractDocumentSchema,
  InvoiceDocumentSchema,
  PolicyDocumentSchema,
  CloseMemoDocumentSchema,
  BoardDeckDocumentSchema,
  AuditWorkpaperDocumentSchema,
  SOPDocumentSchema,
]);
export type FinanceDocument = z.infer<typeof FinanceDocumentSchema>;

import type {
  ContractDocument,
  InvoiceDocument,
  PolicyDocument,
  CloseMemoDocument,
  BoardDeckDocument,
  AuditWorkpaperDocument,
  SOPDocument,
  FinanceDocument,
} from "../documents/schema.js";

const NOW = "2025-10-01T09:00:00.000Z";
const TENANT = "tenant-demo-001";

// ─────────────────────────────────────────────────────────────────────────────
// Contract fixture
// ─────────────────────────────────────────────────────────────────────────────

export const FIXTURE_CONTRACT: ContractDocument = {
  id: "doc-contract-001",
  type: "contract",
  title: "Master Service Agreement — Acme Software Ltd",
  filename: "msa-acme-software-2024.pdf",
  mimeType: "application/pdf",
  sizeBytes: 482_304,
  status: "indexed",
  uploadedAt: NOW,
  uploadedBy: "legal@financeos.io",
  tenantId: TENANT,
  sensitivityLevel: "confidential",
  tags: ["msa", "saas", "acme", "fy2025"],
  sensitivityTags: ["NDA", "CONFIDENTIAL"],
  fiscalYear: 2025,
  period: "FY2025",
  pageCount: 34,
  chunkCount: 48,
  summary:
    "Master Service Agreement between FinanceOS Inc. and Acme Software Ltd. covering software access, data processing, and SLA terms. Auto-renews annually. Governing law: Delaware.",
  contractType: "msa",
  counterparty: "Acme Software Ltd",
  effectiveDate: "2024-01-01",
  expiryDate: "2025-12-31",
  autoRenews: true,
  totalContractValue: 240_000,
  currency: "USD",
  governingLaw: "Delaware, USA",
  signatories: ["Jane Doe (CEO, FinanceOS)", "Bob Chen (CFO, Acme Software)"],
  keyObligations: [
    "Monthly invoicing Net-30",
    "99.9% uptime SLA",
    "30-day renewal notice window",
  ],
  renewalNoticeWindowDays: 30,
  entityLinks: { organization: ["acme-software-ltd"], person: ["jane-doe", "bob-chen"] },
  schemaVersion: "rag.financeos.io/v1",
};

// ─────────────────────────────────────────────────────────────────────────────
// Invoice fixture
// ─────────────────────────────────────────────────────────────────────────────

export const FIXTURE_INVOICE: InvoiceDocument = {
  id: "doc-invoice-001",
  type: "invoice",
  title: "AWS Invoice — September 2025",
  filename: "aws-invoice-sep-2025.pdf",
  mimeType: "application/pdf",
  sizeBytes: 128_450,
  status: "indexed",
  uploadedAt: NOW,
  uploadedBy: "ap@financeos.io",
  tenantId: TENANT,
  sensitivityLevel: "internal",
  tags: ["aws", "cloud", "infrastructure", "q3-fy2025"],
  sensitivityTags: [],
  fiscalYear: 2025,
  period: "Q3",
  pageCount: 6,
  chunkCount: 12,
  summary:
    "Amazon Web Services invoice for cloud infrastructure usage during September 2025. Includes EC2, RDS, S3, and CloudFront charges.",
  invoiceNumber: "AWS-2025-09-000482",
  vendorName: "Amazon Web Services",
  vendorId: "vendor-aws-001",
  invoiceDate: "2025-10-01",
  dueDate: "2025-10-31",
  amountTotal: 84_320.45,
  amountDue: 84_320.45,
  currency: "USD",
  poNumber: "PO-2025-0094",
  glCode: "6200-CLOUD",
  costCenter: "Engineering",
  paymentStatus: "outstanding",
  lineItems: [
    { description: "EC2 Compute (m5.2xlarge × 40)", amount: 41_280.0, glCode: "6200-CLOUD" },
    { description: "RDS PostgreSQL (db.r5.large × 8)", amount: 18_560.0, glCode: "6200-CLOUD" },
    { description: "S3 Storage (48TB)", amount: 11_040.0, glCode: "6200-STORAGE" },
    { description: "CloudFront CDN", amount: 8_920.45, glCode: "6200-CDN" },
    { description: "Data Transfer Out", amount: 4_520.0, glCode: "6200-CLOUD" },
  ],
  entityLinks: { organization: ["amazon-web-services"] },
  schemaVersion: "rag.financeos.io/v1",
};

// ─────────────────────────────────────────────────────────────────────────────
// Policy document fixture
// ─────────────────────────────────────────────────────────────────────────────

export const FIXTURE_POLICY: PolicyDocument = {
  id: "doc-policy-001",
  type: "policy_doc",
  title: "Revenue Recognition Policy — ASC 606",
  filename: "revenue-recognition-policy-v3.pdf",
  mimeType: "application/pdf",
  sizeBytes: 215_040,
  status: "indexed",
  uploadedAt: NOW,
  uploadedBy: "controller@financeos.io",
  tenantId: TENANT,
  sensitivityLevel: "internal",
  tags: ["revenue", "asc606", "policy", "accounting"],
  sensitivityTags: [],
  fiscalYear: 2025,
  period: "FY2025",
  pageCount: 18,
  chunkCount: 32,
  summary:
    "FinanceOS revenue recognition policy in accordance with ASC 606. Defines performance obligations, variable consideration treatment, contract modifications, and SaaS subscription revenue allocation.",
  policyId: "POL-ACCT-001",
  policyOwner: "Controller",
  effectiveDate: "2024-01-01",
  reviewDate: "2026-01-01",
  version: "3.0",
  complianceFrameworks: ["ASC 606", "IFRS 15", "SOX"],
  applicableDepartments: ["Finance", "Revenue Operations", "Legal"],
  approvalChain: ["Controller", "CFO", "Audit Committee"],
  entityLinks: {},
  schemaVersion: "rag.financeos.io/v1",
};

// ─────────────────────────────────────────────────────────────────────────────
// Close memo fixture
// ─────────────────────────────────────────────────────────────────────────────

export const FIXTURE_CLOSE_MEMO: CloseMemoDocument = {
  id: "doc-close-memo-001",
  type: "close_memo",
  title: "Q3 FY2025 Financial Close Memorandum",
  filename: "q3-fy2025-close-memo.pdf",
  mimeType: "application/pdf",
  sizeBytes: 345_088,
  status: "indexed",
  uploadedAt: NOW,
  uploadedBy: "controller@financeos.io",
  tenantId: TENANT,
  sensitivityLevel: "confidential",
  tags: ["close", "q3", "fy2025", "memo"],
  sensitivityTags: ["CONFIDENTIAL", "MNPI"],
  fiscalYear: 2025,
  period: "Q3",
  pageCount: 22,
  chunkCount: 58,
  summary:
    "Q3 FY2025 financial close memo including revenue reconciliation, deferred revenue roll-forward, accruals review, and sign-off by Controller. ARR $195M, Revenue $48.3M, Gross Margin 74.2%.",
  closeType: "quarterly",
  preparedBy: "Sarah Kim (Controller)",
  reviewedBy: ["David Lee (CFO)", "Audit Committee"],
  signedOffBy: "David Lee (CFO)",
  signOffDate: "2025-10-10",
  reportingCurrency: "USD",
  keyIssues: [
    "FX headwind of $1.2M on international segment",
    "Accrual adjustment for professional services ($340K)",
  ],
  adjustments: [
    { description: "Professional services accrual", amount: 340_000, glAccount: "2100-ACCRUED" },
    { description: "FX translation adjustment", amount: -1_200_000, glAccount: "3400-AOCI" },
  ],
  materiality: 500_000,
  entityLinks: { person: ["sarah-kim", "david-lee"] },
  schemaVersion: "rag.financeos.io/v1",
};

// ─────────────────────────────────────────────────────────────────────────────
// Board deck fixture
// ─────────────────────────────────────────────────────────────────────────────

export const FIXTURE_BOARD_DECK: BoardDeckDocument = {
  id: "doc-board-deck-001",
  type: "board_deck",
  title: "Board of Directors — Q3 FY2025 Business Review",
  filename: "bod-q3-fy2025-business-review.pdf",
  mimeType: "application/pdf",
  sizeBytes: 4_194_304,
  status: "indexed",
  uploadedAt: NOW,
  uploadedBy: "cfo@financeos.io",
  tenantId: TENANT,
  sensitivityLevel: "restricted",
  tags: ["board", "q3", "fy2025", "business-review"],
  sensitivityTags: ["RESTRICTED", "MNPI", "BOARD_ONLY"],
  fiscalYear: 2025,
  period: "Q3",
  pageCount: 64,
  chunkCount: 112,
  summary:
    "Q3 FY2025 board package covering business performance, pipeline analysis, hiring plan, strategic initiatives, and FY2026 planning preview. Contains MNPI.",
  meetingDate: "2025-10-15",
  boardMeetingType: "regular",
  presentedBy: ["David Lee (CFO)", "Jane Doe (CEO)"],
  attendees: ["Board Member A", "Board Member B", "Board Member C", "David Lee", "Jane Doe"],
  agendaItems: [
    "Q3 Financial Results",
    "Sales Pipeline Review",
    "Product Roadmap",
    "FY2026 Budget Preview",
    "Compensation Committee Update",
  ],
  resolutions: ["Approved FY2026 option pool expansion"],
  mnpiPresent: true,
  entityLinks: { person: ["david-lee", "jane-doe"] },
  schemaVersion: "rag.financeos.io/v1",
};

// ─────────────────────────────────────────────────────────────────────────────
// Audit workpaper fixture
// ─────────────────────────────────────────────────────────────────────────────

export const FIXTURE_AUDIT_WORKPAPER: AuditWorkpaperDocument = {
  id: "doc-audit-001",
  type: "audit_workpaper",
  title: "SOX ITGC — Access Control Review FY2025",
  filename: "sox-itgc-access-control-fy2025.pdf",
  mimeType: "application/pdf",
  sizeBytes: 892_928,
  status: "indexed",
  uploadedAt: NOW,
  uploadedBy: "internal-audit@financeos.io",
  tenantId: TENANT,
  sensitivityLevel: "restricted",
  tags: ["sox", "itgc", "access-control", "audit", "fy2025"],
  sensitivityTags: ["RESTRICTED", "AUDIT_ONLY"],
  fiscalYear: 2025,
  period: "FY2025",
  pageCount: 48,
  chunkCount: 76,
  summary:
    "SOX ITGC workpaper documenting access control testing for key financial systems. Two medium findings identified: shared service accounts and incomplete quarterly user access reviews.",
  auditType: "sox",
  auditFirm: "Internal Audit",
  auditorName: "Mark Torres (IA Manager)",
  workpaperRef: "WP-SOX-AC-2025-001",
  controlId: "ITGC-AC-01",
  riskRating: "medium",
  findings: [
    "Shared service account detected in ERP system (3 users)",
    "Q2 user access review completed 18 days late",
  ],
  recommendations: [
    "Eliminate shared service accounts by 2025-12-31",
    "Implement automated access review reminders",
  ],
  managementResponse: "Accepted. IT team will remediate shared accounts by Q4 FY2025.",
  remediationDeadline: "2025-12-31",
  remediationStatus: "in_progress",
  entityLinks: { person: ["mark-torres"] },
  schemaVersion: "rag.financeos.io/v1",
};

// ─────────────────────────────────────────────────────────────────────────────
// SOP fixture
// ─────────────────────────────────────────────────────────────────────────────

export const FIXTURE_SOP: SOPDocument = {
  id: "doc-sop-001",
  type: "sop",
  title: "Month-End Close Procedure — Revenue Recognition",
  filename: "sop-month-end-close-revenue-v2.pdf",
  mimeType: "application/pdf",
  sizeBytes: 163_840,
  status: "indexed",
  uploadedAt: NOW,
  uploadedBy: "controller@financeos.io",
  tenantId: TENANT,
  sensitivityLevel: "internal",
  tags: ["sop", "close", "revenue", "monthly"],
  sensitivityTags: [],
  fiscalYear: 2025,
  period: "FY2025",
  pageCount: 14,
  chunkCount: 24,
  summary:
    "Step-by-step procedure for the monthly revenue close process: booking subscription revenue, reviewing deferred revenue roll-forward, reconciling billings to cash, and posting journal entries.",
  sopId: "SOP-FIN-CLOSE-001",
  process: "Month-End Revenue Close",
  department: "Finance",
  processOwner: "Controller",
  version: "2.0",
  effectiveDate: "2024-07-01",
  reviewFrequencyDays: 365,
  systemsInvolved: ["Salesforce CRM", "NetSuite ERP", "Stripe Billing", "FinanceOS"],
  roles: ["Controller", "Revenue Accountant", "AP Specialist"],
  controlPoints: [
    "Dual approval for journal entries > $100K",
    "Controller sign-off on deferred revenue roll-forward",
  ],
  entityLinks: {},
  schemaVersion: "rag.financeos.io/v1",
};

// ─────────────────────────────────────────────────────────────────────────────
// Combined fixtures
// ─────────────────────────────────────────────────────────────────────────────

export const MOCK_FINANCE_DOCUMENTS: FinanceDocument[] = [
  FIXTURE_CONTRACT,
  FIXTURE_INVOICE,
  FIXTURE_POLICY,
  FIXTURE_CLOSE_MEMO,
  FIXTURE_BOARD_DECK,
  FIXTURE_AUDIT_WORKPAPER,
  FIXTURE_SOP,
];

export const MOCK_DOCUMENTS_MAP: Record<string, FinanceDocument> = Object.fromEntries(
  MOCK_FINANCE_DOCUMENTS.map((d) => [d.id, d])
);

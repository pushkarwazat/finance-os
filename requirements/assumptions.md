# Assumptions

These assumptions were made during requirements ingestion where the source document
was inaccessible or ambiguous. Each is tagged with an ID, a confidence level
(`HIGH` / `MEDIUM` / `LOW`), and a corresponding open question (see `open-questions.md`).

All assumptions must be reviewed before production go-live.

---

## A-001 · Reporting Currency is USD [HIGH]

The platform uses USD as the functional and reporting currency throughout.
FX-translated amounts arrive pre-converted from the data warehouse.
All monetary thresholds in governance, approval, and materiality schemas are denominated in USD.

**Linked OQ**: OQ-003
**Review by**: Finance Controller

---

## A-002 · US GAAP is the Primary Accounting Standard [HIGH]

Revenue recognition (ASC 606), lease accounting (ASC 842), and financial instruments
(ASC 815/820) are assumed to follow US GAAP. IFRS support is scaffolded but not enforced.
SOX Section 302 / 404 controls are in scope for a US-listed issuer.

**Linked OQ**: OQ-004
**Review by**: Chief Accounting Officer

---

## A-003 · Materiality Thresholds (Default Values) [MEDIUM]

| Class | USD Threshold | % Threshold |
|-------|--------------|-------------|
| P&L variance | $50,000 | 5 % |
| Balance sheet | $500,000 | 10 % |
| Treasury cash | $25,000 | 2 % |
| Intercompany | $10,000 | 1 % |
| Covenant breach | $0 (any breach) | 0 % |

These defaults are encoded in `packages/governance/src/materiality.ts` and
`packages/governance/src/approval-thresholds.ts`. All values are marked `TODO:CONFIRM`.

**Linked OQ**: OQ-002
**Review by**: CFO + Controller

---

## A-004 · Dual Approval for Material Adjustments [MEDIUM]

Journal entries and metric overrides above materiality require dual approval:
- **Below CFO threshold** ($500,000): Controller approval sufficient.
- **At or above CFO threshold** ($500,000): Controller + CFO required.
- **Covenant waivers**: CFO + Board notification required.

**Linked OQ**: OQ-008
**Review by**: Internal Audit / SOX team

---

## A-005 · Tax Provision Scope: ETR Dashboarding Only [MEDIUM]

The `tax-provision` agent covers:
- Effective Tax Rate (ETR) calculation and trend analysis
- Tax reserve commentary from tax provision workpapers
- Flagging unusual ETR movements for human review

Full deferred tax automation (ASC 740 book/tax differences, valuation allowances)
is **out of scope** for this phase.

**Linked OQ**: OQ-005
**Review by**: Tax Director

---

## A-006 · Intercompany Scope: Loans and Management Fees [MEDIUM]

Automated intercompany reconciliation covers:
- Intercompany loans and interest
- Management fees and service charges

Transfer-priced product sales are **out of scope** unless entity SKU mapping is provided.

**Linked OQ**: OQ-006
**Review by**: Controller / Consolidation Lead

---

## A-007 · Covenant Data from Snowflake Warehouse [MEDIUM]

Covenant metrics (leverage ratio, DSCR, fixed charge coverage, current ratio) are
computed from the Snowflake semantic layer. No direct integration with a Treasury
Management System (TMS) is assumed in this phase.

**Linked OQ**: OQ-007
**Review by**: Treasury team

---

## A-008 · Budget Versioning: Free-Text Labels [LOW]

Budget model versions use free-text labels (e.g. `FY2026-OB`, `FY2026-RF1`).
No automated version promotion or approval workflow is assumed unless FP&A team
specifies a version lifecycle.

**Linked OQ**: OQ-009
**Review by**: FP&A team

---

## A-009 · Single-Tenant Deployment [HIGH]

One `tenantId` per deployment. Row-level security enforces tenant isolation in the
RAG retrieval layer. Multi-tenant SaaS support is architecturally feasible via the
existing `packages/rag/src/tenant/` module but not enabled by default.

**Linked OQ**: OQ-010
**Review by**: Platform Engineering

---

## A-010 · AI Commentary Always Requires Human Approval [HIGH]

No AI-generated text is published externally without human review.
This rule is enforced in every agent output contract and must not be removed
without explicit legal / compliance sign-off and a governance policy update.

**Linked OQ**: OQ-011
**Review by**: Legal / Compliance

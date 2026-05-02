# Open Questions

All items below were identified during requirements ingestion (2026-05-02). Each has a
priority (`P0` = blocking, `P1` = high, `P2` = medium, `P3` = nice-to-have).

---

## OQ-001 · Google Doc Access [P0]

**Question**: The primary source document at
`https://docs.google.com/document/d/1On4xbfab_E4l4O_0G-1_I9hGNgnNVovs6OmuBhmUrh0`
requires Google authentication. The platform currently only has the attached brief text.

**Impact**: Detailed workflow steps, exact metric formulas, named personas, edge cases, and
regulatory specifics may be in the doc but not accessible.

**Resolution**: Share the document publicly (view-only link) or export it and commit to
`requirements/source-document-full.md`. Re-run requirements extraction after access is granted.

---

## OQ-002 · Materiality Thresholds [P1]

**Question**: What are the precise materiality thresholds for budget variances, treasury
balances, and consolidation adjustments?

**Current assumption**: USD 50,000 / 5 % for P&L; USD 500,000 / 10 % for balance sheet;
USD 25,000 for treasury. See `assumptions.md`.

**Resolution**: Finance Controller or CFO to confirm per entity class and reporting tier.

---

## OQ-003 · Multi-Currency Strategy [P1]

**Question**: Should FinanceOS support multi-currency consolidation natively, or is FX
translation handled upstream in the data warehouse?

**Current assumption**: USD is the functional and reporting currency. FX-translated amounts
arrive pre-converted. See `assumptions.md` A-003.

**Resolution**: Confirm with the data engineering team.

---

## OQ-004 · Regulatory Jurisdiction [P1]

**Question**: Which regulatory frameworks are in scope? GAAP-only, IFRS, both, or a subset?

**Current assumption**: US GAAP primary; IFRS flag present but not enforced. SOX compliance
assumed for a US-listed issuer. See `assumptions.md` A-004.

**Resolution**: Legal / accounting team to confirm.

---

## OQ-005 · Tax Provision Depth [P2]

**Question**: Is the tax provision agent expected to perform full ASC 740 deferred tax
analysis (book/tax differences, valuation allowances), or only provide ETR dashboarding?

**Current assumption**: ETR dashboarding + commentary with human sign-off on all adjustments;
no deferred tax automation without explicit scope extension.

**Resolution**: CFO / Tax Director to confirm scope.

---

## OQ-006 · Intercompany Elimination Rules [P2]

**Question**: What intercompany transaction types require automated elimination?
(Loans, sales, management fees, dividends?)

**Current assumption**: Intercompany loans and management fees. Sales eliminations are out of
scope unless the data model includes transfer-priced SKUs. See `assumptions.md` A-006.

**Resolution**: Controller / Consolidation team.

---

## OQ-007 · Covenant Monitoring Data Source [P2]

**Question**: Do covenant metrics (leverage ratio, DSCR, current ratio) come from the
Snowflake warehouse, a treasury system, or a dedicated debt-management system?

**Current assumption**: Sourced from the Snowflake warehouse semantic layer via the same SQL
warehouse adapter. No direct integration with treasury TMS assumed.

**Resolution**: Treasury team to confirm.

---

## OQ-008 · Approval Chains for Material Adjustments [P1]

**Question**: What is the minimum approval chain for journal entries above materiality?
Dual approval (Analyst → Controller)? Triple (Analyst → Controller → CFO)?

**Current assumption**: Dual approval below CFO threshold; triple above. See
`packages/governance/src/approval-thresholds.ts`.

**Resolution**: SOX / Internal Audit to confirm.

---

## OQ-009 · Budget Model Versioning [P2]

**Question**: Should the platform store multiple concurrent budget versions (e.g. Original
Budget, Revised Forecast, Rolling Forecast)? If so, what is the version namespace?

**Current assumption**: `version` field on budget documents supports free-text version labels
(e.g. `"FY2026-OB"`, `"FY2026-RF1"`). No automatic version promotion logic assumed.

**Resolution**: FP&A team to confirm versioning conventions.

---

## OQ-010 · Tenant Isolation Level [P2]

**Question**: Is FinanceOS deployed as a single-tenant SaaS, multi-tenant SaaS, or
on-premise? This affects row-level security, audit scope, and data segregation.

**Current assumption**: Single-tenant per deployment (one `tenantId` per deployment). The RAG
tenant isolation layer exists and is extensible. See `packages/rag/src/tenant/`.

**Resolution**: Platform / Infrastructure team.

---

## OQ-011 · AI Commentary Auto-Publish [P1]

**Question**: Can AI-generated commentary (variance narratives, close memos, budget decks)
ever be published externally without human review?

**Current assumption**: No. All AI-generated material accounting commentary requires
human review and approval before any downstream use. This is enforced in every agent's
output contract. See `packages/agents/src/agents/*.ts`.

**Resolution**: Legal / compliance to confirm. Currently hardcoded to require approval.

---

## OQ-012 · Glossary Source of Truth [P3]

**Question**: Is there an authoritative corporate glossary (Collibra, Atlan, etc.) that
should be the source of truth for metric definitions and synonyms?

**Current assumption**: FinanceOS `packages/semantic/src/schemas/glossary.yaml` is the
source of truth unless a corporate metadata catalog is specified.

**Resolution**: Data governance team.

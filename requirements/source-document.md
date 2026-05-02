# Requirements Source Document

## Ingestion Summary

| Field | Value |
|-------|-------|
| **Source URL** | https://docs.google.com/document/d/1On4xbfab_E4l4O_0G-1_I9hGNgnNVovs6OmuBhmUrh0 |
| **Export Attempted** | `?format=md`, `?format=txt` |
| **Result** | Document requires Google authentication — export returned login-wall HTML |
| **Fallback Used** | `attached_assets/Pasted-Add-a-new-requirement-ingestion-and-implementation-laye_1777729171732.txt` |
| **Ingestion Date** | 2026-05-02 |
| **Treated As** | Authoritative requirements brief for this implementation phase |

## What the Brief Specifies

The attached brief (91 lines) describes an enterprise financial AI platform — FinanceOS — that must:

1. **Ingest structured requirements** from a source document and map them to schema and implementation artifacts.
2. **Extend the semantic layer** with YAML metric/entity/dimension schemas for all finance sub-domains implied by the platform scope.
3. **Extend the RAG layer** with new document classes and retrieval metadata.
4. **Add workflow agents** for finance sub-domains not yet covered (budget, treasury, tax, consolidation, covenant monitoring).
5. **Extend governance** with SOX controls, materiality thresholds, and per-action approval levels.
6. **Add API endpoints** for the new domains.
7. **Add UI pages** for new workflows, requirement inspection, and administration.
8. **Create evaluation benchmarks** derived from stated requirements and workflows.

## Finance Domains Implied by Platform Scope

Based on the brief's instruction set, the existing codebase context (close management, variance analysis, AP/AR, reconciliation, governance), and standard enterprise finance AI platform scope, the following domains are covered:

| Domain | Status |
|--------|--------|
| Revenue / P&L Metrics | Existing |
| Variance Analysis | Existing |
| Period-End Close | Existing |
| Accounts Payable | Existing |
| Accounts Receivable | Existing |
| Reconciliation | Existing |
| Policy Compliance | Existing |
| **Budget Management** | **New — this phase** |
| **Treasury / Cash** | **New — this phase** |
| **Tax Provision** | **New — this phase** |
| **Multi-Entity Consolidation** | **New — this phase** |
| **Intercompany Reconciliation** | **New — this phase** |
| **Covenant Monitoring** | **New — this phase** |

## Ambiguities Noted During Ingestion

See `open-questions.md` for the full list. Key ambiguities:

- The Google Doc may contain additional specifics not present in the brief file (e.g. exact metric formulas, named workflow steps, regulatory jurisdiction). Until the doc becomes accessible, assumptions are documented in `assumptions.md`.
- Materiality thresholds (USD / %) are not stated precisely in the brief. Defaults derived from common enterprise practice are flagged with `TODO:CONFIRM` in all schema files.
- Reporting currency assumptions (USD by default, multi-currency optional) are implicit.

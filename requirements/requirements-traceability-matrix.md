# Requirements Traceability Matrix

Generated: 2026-05-02 | Source: `requirements/extracted-requirements.json`

This matrix maps each business goal and workflow requirement to the implementation
artifacts that fulfil it, the governance controls that govern it, and the eval
benchmarks that verify it.

---

## Legend

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented (this phase or existing) |
| 🆕 | New — implemented this phase |
| ⏳ | Planned — not yet implemented |
| ⚠️ | Partial — scaffolded, needs completion |

---

## Business Goals → Implementation

| Req ID | Business Goal | Priority | Agent / Module | API Route | UI Page | Status |
|--------|--------------|----------|----------------|-----------|---------|--------|
| BG-001 | Automate period-end financial close | P0 | `close-management.ts` | `GET /api/close` | `/close` | ✅ |
| BG-002 | Variance analysis with board commentary | P0 | `variance-analyst.ts` | `GET /api/variance` | `/variance` | ✅ |
| BG-003 | Document Q&A with citation transparency | P0 | RAG layer | `GET /api/ask` | `/ask` | ✅ |
| BG-004 | AP invoice matching and exception routing | P0 | `ap-invoice-research.ts` | `GET /api/workflows` | `/agents` | ✅ |
| BG-005 | AR collections with AI-prioritised outreach | P0 | `ar-collections.ts` | `GET /api/workflows` | `/agents` | ✅ |
| BG-006 | Budget management with FP&A variance tracking | P0 | `budget-management.ts` | `GET /api/budget` | `/budget` | 🆕 |
| BG-007 | Treasury / cash position monitoring | P0 | `treasury-management.ts` | `GET /api/treasury` | `/treasury` | 🆕 |
| BG-008 | Tax provision ETR dashboarding (ASC 740) | P1 | `tax-provision.ts` | ⏳ `/api/tax` | ⏳ `/tax` | ⚠️ Agent+Schema; route+UI pending |
| BG-009 | Multi-entity consolidation | P1 | `consolidation.ts` | `GET /api/consolidation` | `/consolidation` | 🆕 |
| BG-010 | Covenant monitoring and waiver alerts | P1 | `covenant-monitoring.ts` | `GET /api/treasury/covenants` | `/treasury` | 🆕 |
| BG-011 | SOX-compliant controls and dual approvals | P0 | `sox-controls.ts`, `approval-thresholds.ts` | `GET /api/governance` | `/governance` | 🆕 |

---

## User Roles → RBAC Permissions

| Role ID | Role | Key Permissions | New This Phase | Status |
|---------|------|-----------------|----------------|--------|
| UR-001 | viewer | Read-only all domains | No | ✅ |
| UR-002 | analyst | Read/write metrics, documents | No | ✅ |
| UR-003 | finance_manager | Approve low-value items | No | ✅ |
| UR-004 | operator | Workflow state only | No | ✅ |
| UR-005 | controller | Full ops, approve up to CFO threshold | No | ✅ |
| UR-006 | cfo | Governance write, large-value approvals | No | ✅ |
| UR-007 | auditor | Read + audit trail | No | ✅ |
| UR-008 | admin | Full platform | No | ✅ |
| UR-009 | treasury_analyst | Treasury workflows (specialist) | Yes | ⏳ |
| UR-010 | tax_analyst | Tax provision workflows (specialist) | Yes | ⏳ |

---

## Workflow Agents → State Machines → Evidence Requirements

| WF ID | Workflow | Agent File | State Machine | Human Gates | Evidence Required | Status |
|-------|----------|------------|---------------|-------------|-------------------|--------|
| WF-001 | Period-End Close | `close-management.ts` | 10 states | 3 | close_checklist, reconciliation, approval | ✅ |
| WF-002 | Variance Analysis | `variance-analyst.ts` | 12 states | 2 | metric, rag_chunk | ✅ |
| WF-003 | AP Invoice Processing | `ap-invoice-research.ts` | 9 states | 2 | invoice, approval | ✅ |
| WF-004 | AR Collections | `ar-collections.ts` | 11 states | 2 | document, approval | ✅ |
| WF-005 | Reconciliation | `reconciliation.ts` | 10 states | 2 | gl_export, approval | ✅ |
| WF-006 | Budget Management | `budget-management.ts` | 11 transitions | 3 | budget_model, approval, audit_event | 🆕 |
| WF-007 | Treasury Management | `treasury-management.ts` | 11 transitions | 3 | treasury_report, approval | 🆕 |
| WF-008 | Tax Provision | `tax-provision.ts` | 13 transitions | 4 | tax_workpaper, approval (3-tier sign-off) | 🆕 |
| WF-009 | Consolidation | `consolidation.ts` | 14 transitions | 4 | ic_reconciliation, approval, audit_event | 🆕 |
| WF-010 | Covenant Monitoring | `covenant-monitoring.ts` | 14 transitions | 4 | covenant_report, approval | 🆕 |

---

## Document Types → RAG Classes → Document Schemas

| DT ID | Document Type | Zod Schema | Sensitivity | New | Status |
|-------|--------------|------------|-------------|-----|--------|
| DT-001 | contract | `ContractDocumentSchema` | confidential | No | ✅ |
| DT-002 | invoice | `InvoiceDocumentSchema` | internal | No | ✅ |
| DT-003 | policy_doc | `PolicyDocumentSchema` | internal | No | ✅ |
| DT-004 | close_memo | `CloseMemoDocumentSchema` | confidential | No | ✅ |
| DT-005 | board_deck | `BoardDeckDocumentSchema` | restricted | No | ✅ |
| DT-006 | audit_workpaper | `AuditWorkpaperDocumentSchema` | restricted | No | ✅ |
| DT-007 | sop | `SOPDocumentSchema` | internal | No | ✅ |
| DT-008 | budget_model | Schema TBD — extend `BaseDocumentSchema` | confidential | Yes | ⏳ Add to `rag/src/documents/schema.ts` |
| DT-009 | treasury_report | Schema TBD | confidential | Yes | ⏳ |
| DT-010 | tax_provision_workpaper | Schema TBD | restricted | Yes | ⏳ |
| DT-011 | regulatory_filing | Schema TBD | restricted | Yes | ⏳ |
| DT-012 | intercompany_memo | Schema TBD | confidential | Yes | ⏳ |
| DT-013 | covenant_compliance_report | Schema TBD | restricted | Yes | ⏳ |

---

## Governance Controls → SOX Controls → Audit Evidence

| GC ID | Control | Framework | Module | SOX Control ID | Status |
|-------|---------|-----------|--------|----------------|--------|
| GC-001 | All AI outputs require human approval | Internal | `approval-policies.ts` | SOX-FR-002 | ✅ |
| GC-002 | RBAC on all endpoints | Internal | `rbac.ts` | SOX-AM-001/003 | ✅ |
| GC-003 | Immutable audit log | SOX | `audit.ts` | SOX-DI-001 | ✅ |
| GC-004 | Column sensitivity / PII protection | Internal | `column-sensitivity.ts` | SOX-DI-002 | ✅ |
| GC-005 | SOX ITGC controls catalog | SOX | `sox-controls.ts` | All SOX-* | 🆕 |
| GC-006 | Materiality thresholds | GAAP | `materiality.ts` | SOX-FR-001/003 | 🆕 |
| GC-007 | Per-action approval thresholds | Internal | `approval-thresholds.ts` | SOX-FR-001/002/004/005 | 🆕 |

---

## API Endpoints → Route Files → Frontend Pages

| API ID | Endpoint | Route File | UI Page | Status |
|--------|----------|------------|---------|--------|
| API-001 | GET /api/metrics | `metrics.ts` | `/metrics` | ✅ |
| API-002 | GET /api/variance | `variance.ts` | `/variance` | ✅ |
| API-003 | GET /api/close | `close.ts` | `/close` | ✅ |
| API-004 | GET /api/documents | `documents.ts` | `/documents` | ✅ |
| API-005 | GET /api/governance | `governance.ts` | `/governance` | ✅ |
| API-006 | GET /api/agents | `agents.ts` | `/agents` | ✅ |
| API-007 | GET /api/budget/models | `budget.ts` | `/budget` | 🆕 |
| API-008 | GET /api/budget/variance | `budget.ts` | `/budget` | 🆕 |
| API-009 | POST /api/budget/models/:id/approve | `budget.ts` | `/budget` | 🆕 |
| API-010 | GET /api/treasury/positions | `treasury.ts` | `/treasury` | 🆕 |
| API-011 | GET /api/treasury/covenants | `treasury.ts` | `/treasury` | 🆕 |
| API-012 | GET /api/consolidation/runs | `consolidation.ts` | `/consolidation` | 🆕 |
| API-013 | POST /api/consolidation/runs/:id/approve | `consolidation.ts` | `/consolidation` | 🆕 |
| API-014 | GET /api/requirements | `requirements.ts` | `/requirements` | 🆕 |

---

## Semantic Metrics → Categories → Thresholds

| Domain | New Metrics (This Phase) | Schemas | Status |
|--------|--------------------------|---------|--------|
| Budget | budget_variance_revenue, budget_variance_opex, budget_variance_ebitda, forecast_accuracy_rate | `metrics-budget-treasury-tax.yaml` | 🆕 |
| Treasury | cash_position_eop, net_monthly_burn, cash_runway_months, ar_balance, days_sales_outstanding | `metrics-budget-treasury-tax.yaml` | 🆕 |
| Tax | effective_tax_rate, tax_provision_amount | `metrics-budget-treasury-tax.yaml` | 🆕 |
| Consolidation | consolidated_revenue, ic_elimination_balance | `metrics-budget-treasury-tax.yaml` | 🆕 |
| Covenant | net_leverage_ratio, dscr | `metrics-budget-treasury-tax.yaml` | 🆕 |

---

## Eval Benchmarks → Test Coverage

| Suite ID | Suite Name | Cases | Domain | Status |
|----------|-----------|-------|--------|--------|
| suite-analytics-v1 | Finance Analytics — 100Q | 100 | analytics | ✅ |
| suite-variance-v1 | Variance Analysis — 50Q | 50 | variance | ✅ |
| suite-document-evidence-v1 | Document Evidence — 50Q | 50 | document_evidence | ✅ |
| suite-workflow-tasks-v1 | Workflow Tasks — 25Q | 25 | workflow | ✅ |
| suite-ambiguous-v1 | Ambiguous Prompts — 25Q | 25 | ambiguous | ✅ |
| suite-abstain-v1 | Unsupported Prompts — 25Q | 25 | abstain | ✅ |
| suite-regression-v1 | Regression Suite — 25Q | 25 | mixed | ✅ |
| suite-budget-treasury-v1 | Budget & Treasury — 40Q | 40 | budget/treasury | 🆕 |
| suite-consolidation-tax-v1 | Consolidation & Tax — 30Q | 30 | consolidation/tax | 🆕 |
| suite-covenant-governance-v1 | Covenant & Governance — 20Q | 20 | covenant/governance | 🆕 |
| suite-requirements-v1 | Requirements Coverage — 15Q | 15 | mixed | 🆕 |

---

## Open Items (Trace to Open Questions)

| Item | OQ Ref | Impact | Owner |
|------|--------|--------|-------|
| Document types DT-008 through DT-013 need Zod schemas in `rag/src/documents/schema.ts` | OQ-001 | Medium | Engineering |
| Materiality thresholds need CFO/Controller sign-off | OQ-002 | High | CFO + Controller |
| Treasury and tax specialist RBAC roles (UR-009, UR-010) | OQ-010 | Low | Platform team |
| Dedicated `/api/tax` route and `/tax` UI page | OQ-005 | Medium | Engineering |
| FX translation strategy for multi-entity consolidation | OQ-003 | Medium | Data Engineering |

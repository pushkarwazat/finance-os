import { Router } from "express";

const router = Router();

// ─────────────────────────────────────────────────────────────────────────────
// Requirements inspection endpoints
// Exposes the extracted requirements and traceability matrix via API
// so the UI requirements-inspector page can render them.
// ─────────────────────────────────────────────────────────────────────────────

import requirementsJson from "../../../../requirements/extracted-requirements.json" assert { type: "json" };

router.get("/requirements", (_req, res) => {
  res.json({
    data: {
      schemaVersion: requirementsJson.schemaVersion,
      extractedAt: requirementsJson.extractedAt,
      sourceRef: requirementsJson.sourceRef,
      primarySourceStatus: requirementsJson.primarySourceStatus,
      categorySummary: {
        businessGoals: requirementsJson.categories.businessGoals.length,
        userRoles: requirementsJson.categories.userRoles.length,
        workflows: requirementsJson.categories.workflows.length,
        documentTypes: requirementsJson.categories.documentTypes.length,
        apiEndpoints: requirementsJson.categories.apiEndpoints.length,
        uiRequirements: requirementsJson.categories.uiRequirements.length,
        governanceControls: requirementsJson.categories.governanceControls.length,
      },
    },
  });
});

router.get("/requirements/goals", (_req, res) => {
  res.json({ data: requirementsJson.categories.businessGoals });
});

router.get("/requirements/workflows", (_req, res) => {
  res.json({ data: requirementsJson.categories.workflows });
});

router.get("/requirements/roles", (_req, res) => {
  res.json({ data: requirementsJson.categories.userRoles });
});

router.get("/requirements/controls", (_req, res) => {
  res.json({ data: requirementsJson.categories.governanceControls });
});

router.get("/requirements/documents", (_req, res) => {
  res.json({ data: requirementsJson.categories.documentTypes });
});

router.get("/requirements/ui", (_req, res) => {
  res.json({ data: requirementsJson.categories.uiRequirements });
});

router.get("/requirements/api-endpoints", (_req, res) => {
  res.json({ data: requirementsJson.categories.apiEndpoints });
});

router.get("/requirements/assumptions", (_req, res) => {
  res.json({
    note: "Full assumptions documented in requirements/assumptions.md",
    pendingConfirmCount: 8,
    keyAssumptions: [
      { id: "A-001", summary: "Reporting currency is USD", confidence: "HIGH" },
      { id: "A-002", summary: "US GAAP primary accounting standard", confidence: "HIGH" },
      { id: "A-003", summary: "Materiality thresholds are defaults — TODO:CONFIRM with CFO", confidence: "MEDIUM" },
      { id: "A-004", summary: "Dual approval above $500K for P&L, $1M for treasury", confidence: "MEDIUM" },
      { id: "A-005", summary: "Tax provision scope: ETR dashboarding only (no deferred tax automation)", confidence: "MEDIUM" },
      { id: "A-010", summary: "AI commentary always requires human approval", confidence: "HIGH" },
    ],
  });
});

export default router;

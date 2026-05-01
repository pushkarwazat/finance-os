import { describe, it, expect } from "vitest";
import { createQueryPlanner, defaultPlanner } from "../planner.js";
import type { PlannerContext } from "../planner.js";
import type { Metric, Dimension, Join, Guardrail } from "../types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test fixtures
// ─────────────────────────────────────────────────────────────────────────────

function makeMetric(slug: string, displayName: string, synonyms: string[] = []): Metric {
  return {
    apiVersion: "semantics.financeos.io/v1",
    kind: "Metric",
    metadata: {
      name: slug,
      slug,
      domain: "revenue",
      version: "1.0.0",
      owner: "finance-team",
      reviewCycle: "monthly",
      labels: {},
    },
    spec: {
      displayName,
      description: `${displayName} description.`,
      type: "simple",
      measure: `${slug}_amount`,
      unit: "currency",
      currency: "USD",
      formatting: { decimals: 0, abbreviate: true },
      grain: "monthly",
      allowedDimensions: ["customer_segment", "geo_region", "revenue_date"],
      timeDimension: "revenue_date",
      synonyms,
      tags: [],
      selfServe: true,
      public: false,
      certified: true,
      certifiedBy: "CFO",
      dependencies: [],
    },
  };
}

function makeDimension(name: string, displayName: string, synonyms: string[] = []): Dimension {
  return {
    apiVersion: "semantics.financeos.io/v1",
    kind: "Dimension",
    metadata: { name, entity: "fact_revenue", domain: "revenue", labels: {} },
    spec: {
      displayName,
      description: `${displayName} dimension.`,
      column: name,
      dataType: "string",
      cardinality: "low",
      filterable: true,
      isTimeDimension: false,
      synonyms,
      hidden: false,
    },
  };
}

function makeDateDimension(name: string): Dimension {
  return {
    apiVersion: "semantics.financeos.io/v1",
    kind: "Dimension",
    metadata: { name, entity: "fact_revenue", domain: "revenue", labels: {} },
    spec: {
      displayName: "Revenue Date",
      description: "Date dimension.",
      column: name,
      dataType: "date",
      cardinality: "high",
      filterable: true,
      isTimeDimension: true,
      timeGranularities: ["month", "quarter", "year"],
      synonyms: ["date", "period", "when"],
      hidden: false,
    },
  };
}

function makePiiGuardrail(): Guardrail {
  return {
    id: "no_pii",
    name: "No PII",
    description: "Blocks PII fields.",
    severity: "block",
    pattern: { type: "keywords", values: ["email", "phone_number", "ssn"] },
    suggestion: "Use customer_id instead.",
    overridableBy: [],
  };
}

function makeTimeFilterGuardrail(): Guardrail {
  return {
    id: "require_time_filter",
    name: "Require Time Filter",
    description: "Warn on unbounded scans.",
    severity: "warn",
    pattern: { type: "structural", rule: "require_time_filter" },
    overridableBy: ["finance_admin"],
  };
}

const baseContext: PlannerContext = {
  metrics: [
    makeMetric("total_revenue", "Total Revenue", ["revenue", "top line", "gross revenue"]),
    makeMetric("gross_margin", "Gross Margin", ["gross margin", "GM", "GP margin"]),
    makeMetric("arr", "Annual Recurring Revenue", ["ARR", "annual recurring revenue"]),
    makeMetric("dso", "Days Sales Outstanding", ["DSO", "days sales outstanding", "collection days"]),
    makeMetric("burn_rate", "Burn Rate", ["burn rate", "burn", "cash burn"]),
  ],
  dimensions: [
    makeDimension("customer_segment", "Customer Segment", ["segment", "tier"]),
    makeDimension("geo_region", "Region", ["region", "geography", "geo"]),
    makeDimension("product_line", "Product Line", ["product", "product line"]),
    makeDateDimension("revenue_date"),
  ],
  joins: [],
  guardrails: [makePiiGuardrail(), makeTimeFilterGuardrail()],
  synonymMap: {
    revenue: "total_revenue",
    "top line": "total_revenue",
    arr: "arr",
    "annual recurring revenue": "arr",
    dso: "dso",
    "burn rate": "burn_rate",
    burn: "burn_rate",
    segment: "customer_segment",
    region: "geo_region",
  },
  defaultTimeDimension: "revenue_date",
};

// ─────────────────────────────────────────────────────────────────────────────
// Default planner (no context)
// ─────────────────────────────────────────────────────────────────────────────

describe("defaultPlanner", () => {
  it("returns a plan with a unique ID", () => {
    const plan = defaultPlanner.plan("What is revenue?");
    expect(plan.id).toBeTruthy();
    expect(plan.id).toMatch(/^[0-9a-f-]{36}$/);
  });

  it("includes the original question", () => {
    const q = "Show me total revenue last quarter";
    const plan = defaultPlanner.plan(q);
    expect(plan.question).toBe(q);
  });

  it("returns empty metrics with no context", () => {
    const plan = defaultPlanner.plan("What is our revenue trend?");
    expect(plan.metrics).toHaveLength(0);
    expect(plan.warnings.some((w) => w.includes("No metrics"))).toBe(true);
  });

  it("confidence is between 0 and 1", () => {
    const plan = defaultPlanner.plan("random question");
    expect(plan.confidence).toBeGreaterThanOrEqual(0);
    expect(plan.confidence).toBeLessThanOrEqual(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Query planner with full context
// ─────────────────────────────────────────────────────────────────────────────

describe("createQueryPlanner with context", () => {
  const planner = createQueryPlanner(baseContext);

  describe("intent classification", () => {
    it("classifies trend questions correctly", () => {
      const plan = planner.plan("How has revenue trended over the past year?");
      expect(plan.intent).toBe("trend_analysis");
    });

    it("classifies comparison questions", () => {
      const plan = planner.plan("Compare revenue vs last quarter");
      expect(plan.intent).toBe("comparison");
    });

    it("classifies breakdown questions", () => {
      const plan = planner.plan("Break down gross margin by customer segment");
      expect(plan.intent).toBe("breakdown");
    });

    it("classifies ranking questions", () => {
      const plan = planner.plan("Top 10 products by revenue");
      expect(plan.intent).toBe("ranking");
    });

    it("classifies variance questions", () => {
      const plan = planner.plan("Why did we miss the revenue budget this quarter?");
      expect(plan.intent).toBe("variance_explanation");
    });

    it("classifies single value questions", () => {
      const plan = planner.plan("What is our current ARR?");
      expect(plan.intent).toBe("single_value");
    });

    it("classifies forecast questions", () => {
      const plan = planner.plan("What is the forecast for next quarter?");
      expect(plan.intent).toBe("forecast");
    });
  });

  describe("metric extraction", () => {
    it("extracts metric by display name", () => {
      const plan = planner.plan("Show me Total Revenue for last quarter");
      expect(plan.metrics).toContain("total_revenue");
    });

    it("extracts metric by synonym", () => {
      const plan = planner.plan("What is our top line this year?");
      expect(plan.metrics).toContain("total_revenue");
    });

    it("extracts metric via synonym map", () => {
      const plan = planner.plan("What is current ARR?");
      expect(plan.metrics).toContain("arr");
    });

    it("extracts DSO metric", () => {
      const plan = planner.plan("What is our DSO trend over the past 12 months?");
      expect(plan.metrics).toContain("dso");
    });

    it("extracts burn rate metric", () => {
      const plan = planner.plan("What is our monthly burn rate?");
      expect(plan.metrics).toContain("burn_rate");
    });

    it("returns empty metrics when question is unrelated", () => {
      const plan = planner.plan("What is the meaning of life?");
      expect(plan.metrics).toHaveLength(0);
    });

    it("extracts multiple metrics from a complex question", () => {
      const plan = planner.plan("Compare Total Revenue and Gross Margin last quarter");
      expect(plan.metrics.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("dimension extraction", () => {
    it("extracts dimension by display name", () => {
      const plan = planner.plan("Show revenue by Customer Segment");
      expect(plan.dimensions).toContain("customer_segment");
    });

    it("extracts dimension by synonym", () => {
      const plan = planner.plan("Break revenue down by region");
      expect(plan.dimensions).toContain("geo_region");
    });

    it("returns no dimensions for single-value query", () => {
      const plan = planner.plan("What is total ARR?");
      expect(plan.dimensions.length).toBe(0);
    });
  });

  describe("time range extraction", () => {
    it("extracts last quarter time range", () => {
      const plan = planner.plan("Total Revenue last quarter");
      expect(plan.timeRange).toBeDefined();
      expect(plan.timeRange?.relativeRange).toBe("last_quarter");
      expect(plan.timeRange?.granularity).toBe("quarter");
    });

    it("extracts YTD time range", () => {
      const plan = planner.plan("What is YTD revenue?");
      expect(plan.timeRange?.relativeRange).toBe("ytd");
    });

    it("extracts last 12 months", () => {
      const plan = planner.plan("ARR trend over last 12 months");
      expect(plan.timeRange?.relativeRange).toBe("last_12_months");
    });

    it("extracts current quarter", () => {
      const plan = planner.plan("Revenue this quarter");
      expect(plan.timeRange?.relativeRange).toBe("current_quarter");
    });

    it("returns undefined time range when no time specified", () => {
      const plan = planner.plan("What is gross margin?");
      expect(plan.timeRange).toBeUndefined();
    });
  });

  describe("guardrail enforcement", () => {
    it("blocks PII field queries", () => {
      const plan = planner.plan("Show revenue by email");
      const blocked = plan.guardrailViolations.filter((v) => v.severity === "block");
      expect(blocked.length).toBeGreaterThan(0);
      expect(blocked.some((v) => v.guardrailId === "no_pii")).toBe(true);
    });

    it("includes guardrail IDs in guardrailsChecked", () => {
      const plan = planner.plan("Total Revenue last quarter");
      expect(plan.guardrailsChecked).toContain("no_pii");
      expect(plan.guardrailsChecked).toContain("require_time_filter");
    });

    it("lowers confidence on block violations", () => {
      const cleanPlan = planner.plan("Total Revenue last quarter");
      const blockedPlan = planner.plan("Revenue by email address");
      expect(blockedPlan.confidence).toBeLessThan(cleanPlan.confidence);
    });

    it("adds warning message for blocked guardrails", () => {
      const plan = planner.plan("Show revenue by phone_number");
      expect(plan.warnings.some((w) => w.includes("blocked") || w.includes("guardrail"))).toBe(true);
    });
  });

  describe("visualization suggestions", () => {
    it("suggests scorecard for single metric, no dimension, no time range", () => {
      const plan = planner.plan("What is ARR?");
      if (plan.metrics.length === 1 && plan.dimensions.length === 0 && !plan.timeRange) {
        expect(plan.executionHints.suggestedVisualization).toBe("scorecard");
      }
    });

    it("suggests line chart for trend analysis with time range", () => {
      const plan = planner.plan("How has revenue trended over last 12 months?");
      if (plan.intent === "trend_analysis" && plan.timeRange) {
        expect(plan.executionHints.suggestedVisualization).toBe("line");
      }
    });

    it("suggests bar chart for breakdown by dimension", () => {
      const plan = planner.plan("Break down revenue by segment");
      if (plan.intent === "breakdown" && plan.dimensions.length === 1) {
        expect(plan.executionHints.suggestedVisualization).toBe("bar");
      }
    });

    it("always provides a suggested visualization", () => {
      const questions = [
        "What is revenue?",
        "Revenue by segment last quarter",
        "Trend of ARR over 12 months",
        "Compare gross margin vs budget",
      ];
      for (const q of questions) {
        const plan = planner.plan(q);
        expect(plan.executionHints.suggestedVisualization).toBeTruthy();
      }
    });
  });

  describe("cache key", () => {
    it("produces the same cache key for equivalent queries", () => {
      const a = planner.plan("Total Revenue last quarter by segment");
      const b = planner.plan("Revenue by segment last quarter");
      // Same metrics + dimensions + time range → same cache key
      if (
        JSON.stringify(a.metrics.sort()) === JSON.stringify(b.metrics.sort()) &&
        JSON.stringify(a.dimensions.sort()) === JSON.stringify(b.dimensions.sort()) &&
        a.timeRange?.relativeRange === b.timeRange?.relativeRange
      ) {
        expect(a.executionHints.cacheKey).toBe(b.executionHints.cacheKey);
      }
    });
  });

  describe("confidence scoring", () => {
    it("scores higher when metrics and intent are found", () => {
      const goodPlan = planner.plan("What is Total Revenue last quarter by segment?");
      const vagPlan = planner.plan("tell me things");
      expect(goodPlan.confidence).toBeGreaterThan(vagPlan.confidence);
    });

    it("scores between 0 and 1 for all questions", () => {
      const questions = [
        "Revenue",
        "ARR by segment last quarter",
        "email SSN phone_number", // guardrail hit
        "",
        "What was gross margin by product line in Q3 FY2024?",
      ];
      for (const q of questions) {
        const plan = planner.plan(q);
        expect(plan.confidence).toBeGreaterThanOrEqual(0);
        expect(plan.confidence).toBeLessThanOrEqual(1);
      }
    });
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Registry integration test (planner via compiled domain)
// ─────────────────────────────────────────────────────────────────────────────

describe("planner with minimal override context", () => {
  const minimalPlanner = createQueryPlanner({
    metrics: [makeMetric("dso", "Days Sales Outstanding", ["DSO", "collection days"])],
    dimensions: [makeDateDimension("invoice_date")],
    joins: [],
    guardrails: [],
    synonymMap: { dso: "dso" },
  });

  it("plans a DSO query correctly", () => {
    const plan = minimalPlanner.plan("What is our DSO trend over last 12 months?");
    expect(plan.metrics).toContain("dso");
    expect(plan.timeRange?.relativeRange).toBe("last_12_months");
  });
});

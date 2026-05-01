import { describe, it, expect } from "vitest";
import {
  validateEntity,
  validateDimension,
  validateMeasure,
  validateMetric,
  validateJoin,
  validateSynonymFile,
  validateGlossary,
  validateGuardrails,
  validateDomain,
} from "../validator.js";

// ─────────────────────────────────────────────────────────────────────────────
// Entity validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateEntity", () => {
  const validEntity = {
    apiVersion: "semantics.financeos.io/v1",
    kind: "Entity",
    metadata: {
      name: "fact_revenue",
      domain: "revenue",
      description: "Revenue fact table",
      owner: "finance-team",
      labels: {},
    },
    spec: {
      warehouse: "snowflake",
      schema: "finance",
      table: "fact_revenue",
      displayName: "Revenue Transactions",
      primaryKey: ["revenue_id"],
      rlsTags: ["finance"],
      queryable: true,
    },
  };

  it("accepts a valid entity", () => {
    const result = validateEntity(validEntity);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects entity with wrong apiVersion", () => {
    const result = validateEntity({ ...validEntity, apiVersion: "wrong/v1" });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("apiVersion"))).toBe(true);
  });

  it("rejects entity with invalid name (not snake_case)", () => {
    const badEntity = {
      ...validEntity,
      metadata: { ...validEntity.metadata, name: "Fact Revenue" },
    };
    const result = validateEntity(badEntity);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("name"))).toBe(true);
  });

  it("rejects entity with empty primaryKey", () => {
    const badEntity = {
      ...validEntity,
      spec: { ...validEntity.spec, primaryKey: [] },
    };
    const result = validateEntity(badEntity);
    expect(result.valid).toBe(false);
  });

  it("warns when RLS tags are empty", () => {
    const noRls = {
      ...validEntity,
      spec: { ...validEntity.spec, rlsTags: [] },
    };
    const result = validateEntity(noRls);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.path.includes("rlsTags"))).toBe(true);
  });

  it("rejects entity with missing required fields", () => {
    const result = validateEntity({ apiVersion: "semantics.financeos.io/v1", kind: "Entity" });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Dimension validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateDimension", () => {
  const validDimension = {
    apiVersion: "semantics.financeos.io/v1",
    kind: "Dimension",
    metadata: {
      name: "revenue_date",
      entity: "fact_revenue",
      domain: "revenue",
      labels: {},
    },
    spec: {
      displayName: "Revenue Date",
      description: "Date revenue was recognized.",
      column: "recognized_date",
      dataType: "date",
      cardinality: "high",
      filterable: true,
      isTimeDimension: true,
      timeGranularities: ["month", "quarter", "year"],
      synonyms: ["date"],
      hidden: false,
    },
  };

  it("accepts a valid dimension", () => {
    const result = validateDimension(validDimension);
    expect(result.valid).toBe(true);
  });

  it("warns when time dimension has no granularities", () => {
    const noGranularities = {
      ...validDimension,
      spec: { ...validDimension.spec, timeGranularities: [] },
    };
    const result = validateDimension(noGranularities);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.path.includes("timeGranularities"))).toBe(true);
  });

  it("rejects dimension with invalid dataType", () => {
    const badDim = {
      ...validDimension,
      spec: { ...validDimension.spec, dataType: "invalid_type" },
    };
    const result = validateDimension(badDim);
    expect(result.valid).toBe(false);
  });

  it("warns on high-cardinality filterable string without allowedValues", () => {
    const dim = {
      ...validDimension,
      spec: {
        ...validDimension.spec,
        dataType: "string",
        cardinality: "high",
        filterable: true,
        isTimeDimension: false,
      },
    };
    const result = validateDimension(dim);
    expect(result.warnings.some((w) => w.path.includes("cardinality"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Measure validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateMeasure", () => {
  const validMeasure = {
    apiVersion: "semantics.financeos.io/v1",
    kind: "Measure",
    metadata: {
      name: "gross_revenue_amount",
      entity: "fact_revenue",
      domain: "revenue",
      labels: {},
    },
    spec: {
      displayName: "Gross Revenue Amount",
      description: "Sum of gross revenue before deductions.",
      column: "gross_amount_usd",
      aggregation: "sum",
      dataType: "currency",
      grain: "monthly",
      defaultFilters: [],
      nonAdditive: false,
      hidden: false,
    },
  };

  it("accepts a valid measure", () => {
    const result = validateMeasure(validMeasure);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects measure with invalid aggregation", () => {
    const bad = {
      ...validMeasure,
      spec: { ...validMeasure.spec, aggregation: "variance" },
    };
    const result = validateMeasure(bad);
    expect(result.valid).toBe(false);
  });

  it("warns when count_distinct is not marked nonAdditive", () => {
    const countDistinct = {
      ...validMeasure,
      spec: { ...validMeasure.spec, aggregation: "count_distinct", nonAdditive: false },
    };
    const result = validateMeasure(countDistinct);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.path.includes("nonAdditive"))).toBe(true);
  });

  it("rejects measure with invalid grain", () => {
    const bad = { ...validMeasure, spec: { ...validMeasure.spec, grain: "biweekly" } };
    const result = validateMeasure(bad);
    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Metric validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateMetric", () => {
  const validSimpleMetric = {
    apiVersion: "semantics.financeos.io/v1",
    kind: "Metric",
    metadata: {
      name: "total_revenue",
      slug: "total_revenue",
      domain: "revenue",
      version: "2.1.0",
      owner: "finance-team",
      reviewCycle: "monthly",
      labels: {},
    },
    spec: {
      displayName: "Total Revenue",
      shortLabel: "Revenue",
      description: "Total gross revenue recognized.",
      type: "simple",
      measure: "gross_revenue_amount",
      unit: "currency",
      currency: "USD",
      formatting: { prefix: "$", decimals: 0, abbreviate: true },
      grain: "monthly",
      allowedDimensions: ["revenue_date", "customer_segment"],
      timeDimension: "revenue_date",
      synonyms: ["revenue", "top line"],
      tags: ["kpi"],
      selfServe: true,
      public: false,
      certified: true,
      certifiedBy: "CFO Office",
      dependencies: [],
    },
  };

  it("accepts a valid simple metric", () => {
    const result = validateMetric(validSimpleMetric);
    expect(result.valid).toBe(true);
  });

  it("rejects simple metric without measure", () => {
    const bad = {
      ...validSimpleMetric,
      spec: { ...validSimpleMetric.spec, type: "simple", measure: undefined },
    };
    const result = validateMetric(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path.includes("measure"))).toBe(true);
  });

  it("rejects ratio metric without numerator/denominator", () => {
    const ratioMetric = {
      ...validSimpleMetric,
      spec: {
        ...validSimpleMetric.spec,
        type: "ratio",
        measure: undefined,
        numerator: undefined,
        denominator: undefined,
      },
    };
    const result = validateMetric(ratioMetric);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(2);
  });

  it("accepts ratio metric with both numerator and denominator", () => {
    const ratioMetric = {
      ...validSimpleMetric,
      spec: {
        ...validSimpleMetric.spec,
        type: "ratio",
        measure: undefined,
        numerator: "net_revenue_amount",
        denominator: "gross_revenue_amount",
        unit: "percentage",
        formatting: { suffix: "%", decimals: 1, abbreviate: false },
      },
    };
    const result = validateMetric(ratioMetric);
    expect(result.valid).toBe(true);
  });

  it("rejects derived metric without formula", () => {
    const derivedMetric = {
      ...validSimpleMetric,
      spec: {
        ...validSimpleMetric.spec,
        type: "derived",
        measure: undefined,
        formula: undefined,
      },
    };
    const result = validateMetric(derivedMetric);
    expect(result.valid).toBe(false);
  });

  it("warns when metric is not certified", () => {
    const uncertified = {
      ...validSimpleMetric,
      spec: { ...validSimpleMetric.spec, certified: false, certifiedBy: undefined },
    };
    const result = validateMetric(uncertified);
    expect(result.warnings.some((w) => w.path.includes("certified"))).toBe(true);
  });

  it("warns when measure is unknown (cross-reference check)", () => {
    const knownMeasures = new Set<string>(); // empty — measure won't be found
    const result = validateMetric(validSimpleMetric, new Set(), knownMeasures);
    expect(result.warnings.some((w) => w.path.includes("measure"))).toBe(true);
  });

  it("does not warn when measure is in the known set", () => {
    const knownMeasures = new Set(["gross_revenue_amount"]);
    const result = validateMetric(validSimpleMetric, new Set(), knownMeasures);
    expect(result.warnings.filter((w) => w.path.includes("measure"))).toHaveLength(0);
  });

  it("rejects metric with invalid unit", () => {
    const bad = {
      ...validSimpleMetric,
      spec: { ...validSimpleMetric.spec, unit: "bitcoin" },
    };
    const result = validateMetric(bad);
    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Join validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateJoin", () => {
  const validJoin = {
    apiVersion: "semantics.financeos.io/v1",
    kind: "Join",
    metadata: {
      name: "revenue_to_period",
      domain: "revenue",
      labels: {},
    },
    spec: {
      description: "Join revenue to fiscal calendar.",
      left: { entity: "fact_revenue", key: "period_key" },
      right: { entity: "dim_period", key: "period_key" },
      type: "left",
      symmetric: false,
      fanOut: false,
      additionalConditions: [],
      dependentMeasures: [],
    },
  };

  it("accepts a valid join", () => {
    const result = validateJoin(validJoin);
    expect(result.valid).toBe(true);
  });

  it("warns when left entity is not in the known entity set", () => {
    const known = new Set(["dim_period"]); // fact_revenue missing
    const result = validateJoin(validJoin, known);
    expect(result.warnings.some((w) => w.path.includes("left.entity"))).toBe(true);
  });

  it("warns when fanOut is true", () => {
    const fanOut = {
      ...validJoin,
      spec: { ...validJoin.spec, fanOut: true },
    };
    const result = validateJoin(fanOut);
    expect(result.warnings.some((w) => w.path.includes("fanOut"))).toBe(true);
  });

  it("rejects join with invalid type", () => {
    const bad = { ...validJoin, spec: { ...validJoin.spec, type: "cross" } };
    const result = validateJoin(bad);
    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Synonym file validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateSynonymFile", () => {
  const validFile = {
    apiVersion: "semantics.financeos.io/v1",
    kind: "SynonymMap",
    metadata: { domain: "revenue", description: "Revenue synonyms" },
    synonyms: [
      {
        canonical: "total_revenue",
        kind: "metric",
        domain: "revenue",
        terms: ["revenue", "top line", "gross revenue"],
        locales: ["en"],
      },
      {
        canonical: "net_revenue",
        kind: "metric",
        domain: "revenue",
        terms: ["net revenue", "adjusted revenue"],
        locales: ["en"],
      },
    ],
  };

  it("accepts valid synonym file", () => {
    const result = validateSynonymFile(validFile);
    expect(result.valid).toBe(true);
  });

  it("warns on duplicate synonym terms", () => {
    const dup = {
      ...validFile,
      synonyms: [
        ...validFile.synonyms,
        {
          canonical: "net_revenue",
          kind: "metric" as const,
          terms: ["revenue"], // duplicate of first entry
          locales: ["en"],
        },
      ],
    };
    const result = validateSynonymFile(dup);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.message.includes("Duplicate"))).toBe(true);
  });

  it("rejects synonym entry with no terms", () => {
    const bad = {
      ...validFile,
      synonyms: [{ canonical: "total_revenue", kind: "metric", terms: [], locales: ["en"] }],
    };
    const result = validateSynonymFile(bad);
    expect(result.valid).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Glossary validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateGlossary", () => {
  const validGlossary = {
    apiVersion: "semantics.financeos.io/v1",
    kind: "Glossary",
    metadata: { version: "1.0.0" },
    entries: [
      {
        term: "Total Revenue",
        slug: "total_revenue",
        domain: "revenue",
        shortDefinition: "Gross revenue recognized in the period.",
        definition: "Full definition of total revenue.",
        formula: "SUM(gross_amount_usd)",
        examples: ["Q3 revenue was $24.8M."],
        relatedMetrics: ["total_revenue"],
        relatedDimensions: ["revenue_date"],
        seeAlso: ["net_revenue"],
        tags: ["kpi"],
        certifiedBy: "CFO",
        lastReviewed: "2025-10-01",
      },
      {
        term: "Net Revenue",
        slug: "net_revenue",
        domain: "revenue",
        shortDefinition: "Revenue after discounts.",
        definition: "Full definition of net revenue.",
        relatedMetrics: [],
        relatedDimensions: [],
        seeAlso: [],
        tags: [],
        examples: [],
      },
    ],
  };

  it("accepts a valid glossary", () => {
    const result = validateGlossary(validGlossary);
    expect(result.valid).toBe(true);
  });

  it("warns on duplicate slugs", () => {
    const dup = {
      ...validGlossary,
      entries: [
        validGlossary.entries[0],
        { ...validGlossary.entries[1], slug: "total_revenue" }, // duplicate slug
      ],
    };
    const result = validateGlossary(dup);
    expect(result.warnings.some((w) => w.message.includes("Duplicate"))).toBe(true);
  });

  it("warns when seeAlso references unknown slug", () => {
    const bad = {
      ...validGlossary,
      entries: [
        {
          ...validGlossary.entries[0],
          seeAlso: ["nonexistent_slug"],
        },
        validGlossary.entries[1],
      ],
    };
    const result = validateGlossary(bad);
    expect(result.warnings.some((w) => w.message.includes("unknown"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Guardrails validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateGuardrails", () => {
  const validGuardrails = {
    apiVersion: "semantics.financeos.io/v1",
    kind: "Guardrails",
    metadata: { description: "Test guardrails" },
    guardrails: [
      {
        id: "no_pii",
        name: "No PII",
        description: "Blocks PII fields.",
        severity: "block",
        pattern: { type: "keywords", values: ["email", "phone"] },
        suggestion: "Use customer_id instead.",
        overridableBy: [],
      },
    ],
  };

  it("accepts valid guardrails", () => {
    const result = validateGuardrails(validGuardrails);
    expect(result.valid).toBe(true);
  });

  it("warns on duplicate guardrail IDs", () => {
    const dup = {
      ...validGuardrails,
      guardrails: [
        validGuardrails.guardrails[0],
        { ...validGuardrails.guardrails[0], name: "Duplicate" }, // same id
      ],
    };
    const result = validateGuardrails(dup);
    expect(result.warnings.some((w) => w.message.includes("Duplicate"))).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Domain-level batch validation
// ─────────────────────────────────────────────────────────────────────────────

describe("validateDomain", () => {
  it("reports totals across a mixed domain", () => {
    const report = validateDomain("test-domain", {
      entities: [
        {
          apiVersion: "semantics.financeos.io/v1",
          kind: "Entity",
          metadata: { name: "fact_test", domain: "test", description: "Test entity", labels: {} },
          spec: {
            warehouse: "snowflake",
            schema: "finance",
            table: "fact_test",
            displayName: "Test",
            primaryKey: ["id"],
            rlsTags: ["finance"],
            queryable: true,
          },
        },
      ],
      metrics: [
        {
          apiVersion: "semantics.financeos.io/v1",
          kind: "Metric",
          metadata: { name: "test_metric", slug: "test_metric", domain: "test", owner: "team", labels: {} },
          spec: {
            displayName: "Test Metric",
            description: "A test metric",
            type: "simple",
            measure: "test_measure",
            unit: "currency",
            grain: "monthly",
            allowedDimensions: [],
            synonyms: [],
            tags: [],
            selfServe: true,
            public: false,
            certified: false,
            dependencies: [],
            formatting: { decimals: 2, abbreviate: true },
            currency: "USD",
          },
        },
      ],
    });

    expect(report.domain).toBe("test-domain");
    expect(typeof report.totalErrors).toBe("number");
    expect(typeof report.totalWarnings).toBe("number");
    expect(Object.keys(report.results).length).toBeGreaterThan(0);
  });

  it("returns passed=true when there are no errors", () => {
    const report = validateDomain("empty-domain", {});
    expect(report.passed).toBe(true);
    expect(report.totalErrors).toBe(0);
  });
});

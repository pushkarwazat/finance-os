import { z } from "zod";
import {
  EntitySchema,
  DimensionSchema,
  MeasureSchema,
  MetricSchema,
  JoinSchema,
  SynonymFileSchema,
  GlossaryFileSchema,
  GuardrailFileSchema,
  type Entity,
  type Dimension,
  type Measure,
  type Metric,
  type Join,
  type SynonymFile,
  type GlossaryFile,
  type GuardrailFile,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Validation result
// ─────────────────────────────────────────────────────────────────────────────

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationWarning {
  path: string;
  message: string;
}

function zodErrorsToValidationErrors(err: z.ZodError): ValidationError[] {
  return err.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
    value: "received" in issue ? (issue as { received: unknown }).received : undefined,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// Kind-specific structural validators (run after Zod passes)
// ─────────────────────────────────────────────────────────────────────────────

function warnIfMissingOwner(obj: { metadata: { owner?: string } }, warnings: ValidationWarning[]) {
  if (!obj.metadata.owner) {
    warnings.push({ path: "metadata.owner", message: "No owner specified — assign an owner for governance tracking" });
  }
}

function validateMetricCrossReferences(
  metric: Metric,
  knownMetricSlugs: Set<string>,
  knownMeasureNames: Set<string>,
  warnings: ValidationWarning[],
): ValidationError[] {
  const errors: ValidationError[] = [];

  if (metric.spec.type === "simple" && !metric.spec.measure) {
    errors.push({ path: "spec.measure", message: "Simple metrics must specify 'measure'" });
  }
  if (metric.spec.type === "ratio") {
    if (!metric.spec.numerator) errors.push({ path: "spec.numerator", message: "Ratio metrics must specify 'numerator'" });
    if (!metric.spec.denominator) errors.push({ path: "spec.denominator", message: "Ratio metrics must specify 'denominator'" });
  }
  if (metric.spec.type === "derived") {
    if (!metric.spec.formula) errors.push({ path: "spec.formula", message: "Derived metrics must specify 'formula'" });
    for (const dep of metric.spec.dependencies) {
      if (!knownMetricSlugs.has(dep)) {
        warnings.push({ path: `spec.dependencies[${dep}]`, message: `Dependency '${dep}' not found in known metrics — may be defined in another domain` });
      }
    }
  }
  if (metric.spec.measure && !knownMeasureNames.has(metric.spec.measure)) {
    warnings.push({ path: "spec.measure", message: `Measure '${metric.spec.measure}' not found in known measures — may be defined in another domain` });
  }
  return errors;
}

function validateJoinCrossReferences(
  join: Join,
  knownEntityNames: Set<string>,
  warnings: ValidationWarning[],
): ValidationError[] {
  const errors: ValidationError[] = [];
  if (!knownEntityNames.has(join.spec.left.entity)) {
    warnings.push({ path: "spec.left.entity", message: `Entity '${join.spec.left.entity}' not found in known entities` });
  }
  if (!knownEntityNames.has(join.spec.right.entity)) {
    warnings.push({ path: "spec.right.entity", message: `Entity '${join.spec.right.entity}' not found in known entities` });
  }
  if (join.spec.fanOut) {
    warnings.push({ path: "spec.fanOut", message: "Fan-out join detected — query planner will require pre-aggregation" });
  }
  return errors;
}

// ─────────────────────────────────────────────────────────────────────────────
// Public validators
// ─────────────────────────────────────────────────────────────────────────────

export function validateEntity(raw: unknown): ValidationResult {
  const parse = EntitySchema.safeParse(raw);
  if (!parse.success) {
    return { valid: false, errors: zodErrorsToValidationErrors(parse.error), warnings: [] };
  }
  const warnings: ValidationWarning[] = [];
  warnIfMissingOwner(parse.data as any, warnings);
  if (parse.data.spec.rlsTags.length === 0) {
    warnings.push({ path: "spec.rlsTags", message: "No RLS tags — entity is accessible to all roles" });
  }
  return { valid: true, errors: [], warnings };
}

export function validateDimension(raw: unknown): ValidationResult {
  const parse = DimensionSchema.safeParse(raw);
  if (!parse.success) {
    return { valid: false, errors: zodErrorsToValidationErrors(parse.error), warnings: [] };
  }
  const warnings: ValidationWarning[] = [];
  const dim = parse.data;
  if (dim.spec.isTimeDimension && (!dim.spec.timeGranularities || dim.spec.timeGranularities.length === 0)) {
    warnings.push({ path: "spec.timeGranularities", message: "Time dimension has no allowed granularities specified" });
  }
  if (dim.spec.dataType === "string" && dim.spec.cardinality === "high" && dim.spec.filterable) {
    warnings.push({ path: "spec.cardinality", message: "High-cardinality string dimension is filterable — consider adding allowedValues" });
  }
  return { valid: true, errors: [], warnings };
}

export function validateMeasure(raw: unknown): ValidationResult {
  const parse = MeasureSchema.safeParse(raw);
  if (!parse.success) {
    return { valid: false, errors: zodErrorsToValidationErrors(parse.error), warnings: [] };
  }
  const warnings: ValidationWarning[] = [];
  const m = parse.data;
  if (m.spec.aggregation === "count_distinct" && !m.spec.nonAdditive) {
    warnings.push({ path: "spec.nonAdditive", message: "count_distinct measures are non-additive — set nonAdditive: true" });
  }
  return { valid: true, errors: [], warnings };
}

export function validateMetric(
  raw: unknown,
  knownMetricSlugs: Set<string> = new Set(),
  knownMeasureNames: Set<string> = new Set(),
): ValidationResult {
  const parse = MetricSchema.safeParse(raw);
  if (!parse.success) {
    return { valid: false, errors: zodErrorsToValidationErrors(parse.error), warnings: [] };
  }
  const warnings: ValidationWarning[] = [];
  const errors = validateMetricCrossReferences(parse.data, knownMetricSlugs, knownMeasureNames, warnings);
  if (errors.length > 0) return { valid: false, errors, warnings };
  if (!parse.data.spec.certified) {
    warnings.push({ path: "spec.certified", message: "Metric is not certified — results may be unofficial" });
  }
  return { valid: true, errors: [], warnings };
}

export function validateJoin(
  raw: unknown,
  knownEntityNames: Set<string> = new Set(),
): ValidationResult {
  const parse = JoinSchema.safeParse(raw);
  if (!parse.success) {
    return { valid: false, errors: zodErrorsToValidationErrors(parse.error), warnings: [] };
  }
  const warnings: ValidationWarning[] = [];
  const errors = validateJoinCrossReferences(parse.data, knownEntityNames, warnings);
  if (errors.length > 0) return { valid: false, errors, warnings };
  return { valid: true, errors: [], warnings };
}

export function validateSynonymFile(raw: unknown): ValidationResult {
  const parse = SynonymFileSchema.safeParse(raw);
  if (!parse.success) {
    return { valid: false, errors: zodErrorsToValidationErrors(parse.error), warnings: [] };
  }
  const warnings: ValidationWarning[] = [];
  const seen = new Set<string>();
  for (const entry of parse.data.synonyms) {
    for (const term of entry.terms) {
      const key = term.toLowerCase().trim();
      if (seen.has(key)) {
        warnings.push({ path: "synonyms", message: `Duplicate synonym term '${term}' detected` });
      }
      seen.add(key);
    }
  }
  return { valid: true, errors: [], warnings };
}

export function validateGlossary(raw: unknown): ValidationResult {
  const parse = GlossaryFileSchema.safeParse(raw);
  if (!parse.success) {
    return { valid: false, errors: zodErrorsToValidationErrors(parse.error), warnings: [] };
  }
  const warnings: ValidationWarning[] = [];
  const slugs = parse.data.entries.map((e) => e.slug);
  const dupSlugs = slugs.filter((s, i) => slugs.indexOf(s) !== i);
  if (dupSlugs.length > 0) {
    warnings.push({ path: "entries", message: `Duplicate glossary slugs: ${dupSlugs.join(", ")}` });
  }
  for (const entry of parse.data.entries) {
    if (entry.seeAlso.some((slug) => !slugs.includes(slug))) {
      warnings.push({ path: `entries[${entry.slug}].seeAlso`, message: "seeAlso references unknown glossary slug" });
    }
  }
  return { valid: true, errors: [], warnings };
}

export function validateGuardrails(raw: unknown): ValidationResult {
  const parse = GuardrailFileSchema.safeParse(raw);
  if (!parse.success) {
    return { valid: false, errors: zodErrorsToValidationErrors(parse.error), warnings: [] };
  }
  const warnings: ValidationWarning[] = [];
  const ids = parse.data.guardrails.map((g) => g.id);
  const dupIds = ids.filter((id, i) => ids.indexOf(id) !== i);
  if (dupIds.length > 0) {
    warnings.push({ path: "guardrails", message: `Duplicate guardrail IDs: ${dupIds.join(", ")}` });
  }
  return { valid: true, errors: [], warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Batch validator — validates an entire domain folder's parsed YAML
// ─────────────────────────────────────────────────────────────────────────────

export interface DomainValidationReport {
  domain: string;
  passed: boolean;
  results: Record<string, ValidationResult>;
  totalErrors: number;
  totalWarnings: number;
}

export function validateDomain(
  domain: string,
  parsed: {
    entities?: unknown[];
    dimensions?: unknown[];
    measures?: unknown[];
    metrics?: unknown[];
    joins?: unknown[];
    synonyms?: unknown;
  },
): DomainValidationReport {
  const results: Record<string, ValidationResult> = {};
  let totalErrors = 0;
  let totalWarnings = 0;

  const knownEntityNames = new Set<string>(
    (parsed.entities ?? []).map((e: any) => e?.metadata?.name).filter(Boolean)
  );
  const knownMeasureNames = new Set<string>(
    (parsed.measures ?? []).map((m: any) => m?.metadata?.name).filter(Boolean)
  );
  const knownMetricSlugs = new Set<string>(
    (parsed.metrics ?? []).map((m: any) => m?.metadata?.slug).filter(Boolean)
  );

  (parsed.entities ?? []).forEach((e, i) => {
    const r = validateEntity(e);
    results[`entities[${i}]`] = r;
    totalErrors += r.errors.length;
    totalWarnings += r.warnings.length;
  });
  (parsed.dimensions ?? []).forEach((d, i) => {
    const r = validateDimension(d);
    results[`dimensions[${i}]`] = r;
    totalErrors += r.errors.length;
    totalWarnings += r.warnings.length;
  });
  (parsed.measures ?? []).forEach((m, i) => {
    const r = validateMeasure(m);
    results[`measures[${i}]`] = r;
    totalErrors += r.errors.length;
    totalWarnings += r.warnings.length;
  });
  (parsed.metrics ?? []).forEach((m, i) => {
    const r = validateMetric(m, knownMetricSlugs, knownMeasureNames);
    results[`metrics[${i}]`] = r;
    totalErrors += r.errors.length;
    totalWarnings += r.warnings.length;
  });
  (parsed.joins ?? []).forEach((j, i) => {
    const r = validateJoin(j, knownEntityNames);
    results[`joins[${i}]`] = r;
    totalErrors += r.errors.length;
    totalWarnings += r.warnings.length;
  });
  if (parsed.synonyms) {
    const r = validateSynonymFile(parsed.synonyms);
    results["synonyms"] = r;
    totalErrors += r.errors.length;
    totalWarnings += r.warnings.length;
  }

  return { domain, passed: totalErrors === 0, results, totalErrors, totalWarnings };
}

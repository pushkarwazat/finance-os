import type {
  Entity,
  Dimension,
  Measure,
  Metric,
  Join,
  SynonymFile,
  CompiledDomain,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Compiler  — merges validated YAML objects into a CompiledDomain
// ─────────────────────────────────────────────────────────────────────────────

export interface DomainInput {
  domain: string;
  entities?: Entity[];
  dimensions?: Dimension[];
  measures?: Measure[];
  metrics?: Metric[];
  joins?: Join[];
  synonymFiles?: SynonymFile[];
}

export interface CompileResult {
  compiled?: CompiledDomain;
  errors: string[];
  warnings: string[];
}

export function compileDomain(input: DomainInput): CompileResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  const {
    domain,
    entities = [],
    dimensions = [],
    measures = [],
    metrics = [],
    joins = [],
    synonymFiles = [],
  } = input;

  // ── 1. Resolve synonym map (term → canonical slug) ──────────────────────
  const synonymMap: Record<string, string> = {};
  for (const sf of synonymFiles) {
    for (const entry of sf.synonyms) {
      for (const term of entry.terms) {
        const key = term.toLowerCase().trim();
        if (synonymMap[key] && synonymMap[key] !== entry.canonical) {
          warnings.push(
            `Synonym conflict: '${term}' maps to both '${synonymMap[key]}' and '${entry.canonical}' — keeping first`
          );
        } else {
          synonymMap[key] = entry.canonical;
        }
      }
    }
  }

  // ── 2. Validate metric dependency graph (detect cycles) ──────────────────
  const metricSlugSet = new Set(metrics.map((m) => m.metadata.slug));

  function hasCycle(slug: string, visiting: Set<string>): boolean {
    if (visiting.has(slug)) return true;
    const metric = metrics.find((m) => m.metadata.slug === slug);
    if (!metric) return false;
    visiting.add(slug);
    for (const dep of metric.spec.dependencies) {
      if (hasCycle(dep, new Set(visiting))) return true;
    }
    return false;
  }

  for (const metric of metrics) {
    if (hasCycle(metric.metadata.slug, new Set())) {
      errors.push(`Circular dependency detected in metric '${metric.metadata.slug}'`);
    }
  }

  // ── 3. Validate join references ──────────────────────────────────────────
  const entityNames = new Set(entities.map((e) => e.metadata.name));
  for (const join of joins) {
    if (!entityNames.has(join.spec.left.entity)) {
      warnings.push(`Join '${join.metadata.name}': left entity '${join.spec.left.entity}' not defined in this domain`);
    }
    if (!entityNames.has(join.spec.right.entity)) {
      warnings.push(`Join '${join.metadata.name}': right entity '${join.spec.right.entity}' not defined in this domain`);
    }
  }

  // ── 4. Validate dimension entity references ──────────────────────────────
  for (const dim of dimensions) {
    if (dim.metadata.entity && !entityNames.has(dim.metadata.entity)) {
      warnings.push(`Dimension '${dim.metadata.name}': entity '${dim.metadata.entity}' not defined in this domain`);
    }
  }

  // ── 5. Validate measure entity references ───────────────────────────────
  const measureNames = new Set(measures.map((m) => m.metadata.name));
  for (const measure of measures) {
    if (measure.metadata.entity && !entityNames.has(measure.metadata.entity)) {
      warnings.push(`Measure '${measure.metadata.name}': entity '${measure.metadata.entity}' not defined in this domain`);
    }
  }

  // ── 6. Validate metric → measure references ──────────────────────────────
  for (const metric of metrics) {
    if (metric.spec.measure && !measureNames.has(metric.spec.measure)) {
      warnings.push(`Metric '${metric.metadata.slug}': measure '${metric.spec.measure}' not found in this domain`);
    }
    if (metric.spec.numerator && !measureNames.has(metric.spec.numerator)) {
      warnings.push(`Metric '${metric.metadata.slug}': numerator '${metric.spec.numerator}' not found in this domain`);
    }
    if (metric.spec.denominator && !measureNames.has(metric.spec.denominator)) {
      warnings.push(`Metric '${metric.metadata.slug}': denominator '${metric.spec.denominator}' not found in this domain`);
    }
  }

  if (errors.length > 0) {
    return { errors, warnings };
  }

  // ── 7. Assemble compiled model ───────────────────────────────────────────
  const compiled: CompiledDomain = {
    domain,
    version: "1.0.0",
    compiledAt: new Date().toISOString(),
    entities: entities.map((e) => e.spec),
    dimensions: dimensions.map((d) => d.spec),
    measures: measures.map((m) => m.spec),
    metrics: metrics.map((m) => m.spec),
    joins: joins.map((j) => j.spec),
    synonymMap,
  };

  return { compiled, errors: [], warnings };
}

// ─────────────────────────────────────────────────────────────────────────────
// Multi-domain compiler
// ─────────────────────────────────────────────────────────────────────────────

export interface MultiDomainInput {
  domains: DomainInput[];
}

export interface MultiDomainCompileResult {
  results: Map<string, CompileResult>;
  globalSynonymMap: Record<string, string>;
  allErrors: string[];
  allWarnings: string[];
}

export function compileMultiDomain(input: MultiDomainInput): MultiDomainCompileResult {
  const results = new Map<string, CompileResult>();
  const globalSynonymMap: Record<string, string> = {};
  const allErrors: string[] = [];
  const allWarnings: string[] = [];

  for (const domainInput of input.domains) {
    const result = compileDomain(domainInput);
    results.set(domainInput.domain, result);
    allErrors.push(...result.errors.map((e) => `[${domainInput.domain}] ${e}`));
    allWarnings.push(...result.warnings.map((w) => `[${domainInput.domain}] ${w}`));
    if (result.compiled) {
      Object.assign(globalSynonymMap, result.compiled.synonymMap);
    }
  }

  return { results, globalSynonymMap, allErrors, allWarnings };
}

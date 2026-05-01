import type {
  Metric,
  Dimension,
  Measure,
  Entity,
  Join,
  GlossaryEntry,
  CompiledDomain,
} from "./types.js";

// ─────────────────────────────────────────────────────────────────────────────
// In-memory semantic model registry
// ─────────────────────────────────────────────────────────────────────────────

export interface SemanticRegistry {
  // Metrics
  registerMetric(metric: Metric): void;
  getMetric(slug: string): Metric | undefined;
  listMetrics(domain?: string): Metric[];
  findMetricsByTag(tag: string): Metric[];
  findMetricsBySynonym(term: string): Metric[];

  // Entities
  registerEntity(entity: Entity): void;
  getEntity(name: string): Entity | undefined;
  listEntities(domain?: string): Entity[];

  // Dimensions
  registerDimension(dimension: Dimension): void;
  getDimension(name: string): Dimension | undefined;
  listDimensions(entity?: string): Dimension[];
  listTimeDimensions(): Dimension[];

  // Measures
  registerMeasure(measure: Measure): void;
  getMeasure(name: string): Measure | undefined;
  listMeasures(entity?: string): Measure[];

  // Joins
  registerJoin(join: Join): void;
  getJoin(name: string): Join | undefined;
  listJoins(entity?: string): Join[];
  findJoinPath(fromEntity: string, toEntity: string): Join | undefined;

  // Glossary
  registerGlossaryEntry(entry: GlossaryEntry): void;
  getGlossaryEntry(slug: string): GlossaryEntry | undefined;
  listGlossaryEntries(domain?: string): GlossaryEntry[];
  searchGlossary(query: string): GlossaryEntry[];

  // Compiled domains
  registerCompiledDomain(compiled: CompiledDomain): void;
  getCompiledDomain(domain: string): CompiledDomain | undefined;
  listDomains(): string[];

  // Synonym resolution
  resolveSynonym(term: string): string | undefined;
  registerSynonym(term: string, canonical: string): void;

  // Stats
  stats(): RegistryStats;
}

export interface RegistryStats {
  metrics: number;
  entities: number;
  dimensions: number;
  measures: number;
  joins: number;
  glossaryEntries: number;
  domains: number;
  synonymTerms: number;
}

export function createInMemoryRegistry(): SemanticRegistry {
  const metrics = new Map<string, Metric>();
  const entities = new Map<string, Entity>();
  const dimensions = new Map<string, Dimension>();
  const measures = new Map<string, Measure>();
  const joins = new Map<string, Join>();
  const glossary = new Map<string, GlossaryEntry>();
  const compiledDomains = new Map<string, CompiledDomain>();
  const synonyms = new Map<string, string>(); // term → canonical

  return {
    // ── Metrics ────────────────────────────────────────────────────────────
    registerMetric(metric) {
      metrics.set(metric.metadata.slug, metric);
    },
    getMetric(slug) {
      return metrics.get(slug);
    },
    listMetrics(domain) {
      const all = Array.from(metrics.values());
      return domain ? all.filter((m) => m.metadata.domain === domain) : all;
    },
    findMetricsByTag(tag) {
      return Array.from(metrics.values()).filter((m) => m.spec.tags.includes(tag));
    },
    findMetricsBySynonym(term) {
      const lower = term.toLowerCase().trim();
      return Array.from(metrics.values()).filter(
        (m) =>
          m.spec.synonyms.some((s) => s.toLowerCase() === lower) ||
          m.spec.displayName.toLowerCase().includes(lower) ||
          m.metadata.slug.replace(/_/g, " ") === lower
      );
    },

    // ── Entities ───────────────────────────────────────────────────────────
    registerEntity(entity) {
      entities.set(entity.metadata.name, entity);
    },
    getEntity(name) {
      return entities.get(name);
    },
    listEntities(domain) {
      const all = Array.from(entities.values());
      return domain ? all.filter((e) => e.metadata.domain === domain) : all;
    },

    // ── Dimensions ─────────────────────────────────────────────────────────
    registerDimension(dimension) {
      dimensions.set(dimension.metadata.name, dimension);
    },
    getDimension(name) {
      return dimensions.get(name);
    },
    listDimensions(entity) {
      const all = Array.from(dimensions.values()).filter((d) => !d.spec.hidden);
      return entity ? all.filter((d) => d.metadata.entity === entity) : all;
    },
    listTimeDimensions() {
      return Array.from(dimensions.values()).filter((d) => d.spec.isTimeDimension);
    },

    // ── Measures ───────────────────────────────────────────────────────────
    registerMeasure(measure) {
      measures.set(measure.metadata.name, measure);
    },
    getMeasure(name) {
      return measures.get(name);
    },
    listMeasures(entity) {
      const all = Array.from(measures.values()).filter((m) => !m.spec.hidden);
      return entity ? all.filter((m) => m.metadata.entity === entity) : all;
    },

    // ── Joins ──────────────────────────────────────────────────────────────
    registerJoin(join) {
      joins.set(join.metadata.name, join);
    },
    getJoin(name) {
      return joins.get(name);
    },
    listJoins(entity) {
      const all = Array.from(joins.values());
      return entity
        ? all.filter((j) => j.spec.left.entity === entity || j.spec.right.entity === entity)
        : all;
    },
    findJoinPath(fromEntity, toEntity) {
      return Array.from(joins.values()).find(
        (j) =>
          (j.spec.left.entity === fromEntity && j.spec.right.entity === toEntity) ||
          (j.spec.symmetric &&
            j.spec.left.entity === toEntity &&
            j.spec.right.entity === fromEntity)
      );
    },

    // ── Glossary ───────────────────────────────────────────────────────────
    registerGlossaryEntry(entry) {
      glossary.set(entry.slug, entry);
    },
    getGlossaryEntry(slug) {
      return glossary.get(slug);
    },
    listGlossaryEntries(domain) {
      const all = Array.from(glossary.values());
      return domain ? all.filter((e) => e.domain === domain) : all;
    },
    searchGlossary(query) {
      const lower = query.toLowerCase();
      return Array.from(glossary.values()).filter(
        (e) =>
          e.term.toLowerCase().includes(lower) ||
          e.shortDefinition.toLowerCase().includes(lower) ||
          e.tags.some((t) => t.toLowerCase().includes(lower))
      );
    },

    // ── Compiled Domains ───────────────────────────────────────────────────
    registerCompiledDomain(compiled) {
      compiledDomains.set(compiled.domain, compiled);
      // Also hydrate synonym map
      for (const [term, canonical] of Object.entries(compiled.synonymMap)) {
        synonyms.set(term, canonical);
      }
    },
    getCompiledDomain(domain) {
      return compiledDomains.get(domain);
    },
    listDomains() {
      return Array.from(compiledDomains.keys());
    },

    // ── Synonyms ───────────────────────────────────────────────────────────
    resolveSynonym(term) {
      return synonyms.get(term.toLowerCase().trim());
    },
    registerSynonym(term, canonical) {
      synonyms.set(term.toLowerCase().trim(), canonical);
    },

    // ── Stats ──────────────────────────────────────────────────────────────
    stats() {
      return {
        metrics: metrics.size,
        entities: entities.size,
        dimensions: dimensions.size,
        measures: measures.size,
        joins: joins.size,
        glossaryEntries: glossary.size,
        domains: compiledDomains.size,
        synonymTerms: synonyms.size,
      };
    },
  };
}

export const globalRegistry = createInMemoryRegistry();

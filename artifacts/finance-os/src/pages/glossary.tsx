import { useState, useMemo } from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import { Search, BookOpen, CheckCircle2, Code2, Link2, Tag, ChevronDown, ChevronUp, Database } from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// Types (inferred from the API response shape)
// ─────────────────────────────────────────────────────────────────────────────

interface GlossaryEntry {
  term: string
  slug: string
  domain: string
  shortDefinition: string
  definition: string
  formula?: string
  relatedMetrics: string[]
  tags: string[]
  certifiedBy?: string
  lastReviewed?: string
}

interface DomainSummary {
  name: string
  label: string
  metricCount: number
  entityCount: number
  certifiedMetrics: number
}

interface GlossaryResponse {
  data: GlossaryEntry[]
  total: number
  domains: string[]
  allTags: string[]
}

interface DomainsResponse {
  data: DomainSummary[]
}

// ─────────────────────────────────────────────────────────────────────────────
// Data hooks
// ─────────────────────────────────────────────────────────────────────────────

const BASE = import.meta.env.BASE_URL

function apiUrl(path: string) {
  return `${BASE}api${path}`
}

function useGlossary() {
  return useQuery<GlossaryResponse>({
    queryKey: ["/api/semantic/glossary"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/semantic/glossary"))
      if (!res.ok) throw new Error("Failed to fetch glossary")
      return res.json()
    },
  })
}

function useDomains() {
  return useQuery<DomainsResponse>({
    queryKey: ["/api/semantic/domains"],
    queryFn: async () => {
      const res = await fetch(apiUrl("/semantic/domains"))
      if (!res.ok) throw new Error("Failed to fetch domains")
      return res.json()
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain colour map
// ─────────────────────────────────────────────────────────────────────────────

const DOMAIN_COLORS: Record<string, string> = {
  revenue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  subscriptions: "bg-violet-500/10 text-violet-600 border-violet-500/20",
  customers: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
  invoices: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  payments: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20",
  expenses: "bg-rose-500/10 text-rose-600 border-rose-500/20",
  budget_vs_actual: "bg-indigo-500/10 text-indigo-600 border-indigo-500/20",
  collections: "bg-orange-500/10 text-orange-600 border-orange-500/20",
}

const DOMAIN_LABELS: Record<string, string> = {
  revenue: "Revenue",
  subscriptions: "Subscriptions",
  customers: "Customers",
  invoices: "Invoices & AR",
  payments: "Payments",
  expenses: "Expenses",
  budget_vs_actual: "Budget vs Actual",
  collections: "Collections",
}

// ─────────────────────────────────────────────────────────────────────────────
// Domain overview stats strip
// ─────────────────────────────────────────────────────────────────────────────

function DomainStatsStrip({ domains }: { domains: DomainSummary[] }) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-2">
      {domains.map((d) => (
        <div
          key={d.name}
          className={cn(
            "rounded-lg border p-3 flex flex-col gap-1 cursor-default transition-colors",
            DOMAIN_COLORS[d.name] ?? "bg-muted text-muted-foreground",
          )}
        >
          <span className="text-[10px] font-semibold uppercase tracking-widest opacity-70 truncate">
            {d.label}
          </span>
          <span className="text-xl font-bold leading-none">{d.metricCount}</span>
          <span className="text-[10px] opacity-60">metrics · {d.entityCount} entities</span>
        </div>
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Glossary entry card
// ─────────────────────────────────────────────────────────────────────────────

function GlossaryCard({ entry }: { entry: GlossaryEntry }) {
  const [expanded, setExpanded] = useState(false)

  return (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-semibold text-base leading-snug">{entry.term}</h3>
              {entry.certifiedBy && (
                <span className="flex items-center gap-1 text-[10px] text-emerald-600 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-2 py-0.5 font-medium shrink-0">
                  <CheckCircle2 className="h-3 w-3" />
                  Certified
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed">{entry.shortDefinition}</p>
          </div>

          <Badge
            variant="outline"
            className={cn(
              "shrink-0 text-[10px] px-2 py-0.5 capitalize",
              DOMAIN_COLORS[entry.domain] ?? "bg-muted text-muted-foreground",
            )}
          >
            {DOMAIN_LABELS[entry.domain] ?? entry.domain}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-4 space-y-3">
        {/* Formula pill */}
        {entry.formula && (
          <div className="flex items-start gap-2 rounded-md bg-muted/60 px-3 py-2">
            <Code2 className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
            <code className="text-xs text-foreground/80 font-mono break-all leading-relaxed">
              {entry.formula}
            </code>
          </div>
        )}

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {entry.tags.map((tag) => (
              <span
                key={tag}
                className="inline-flex items-center gap-1 text-[10px] rounded px-1.5 py-0.5 bg-secondary text-secondary-foreground font-medium"
              >
                <Tag className="h-2.5 w-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Expandable full definition */}
        <button
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
        >
          {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
          {expanded ? "Hide" : "Read"} full definition
        </button>

        {expanded && (
          <div className="space-y-3 pt-1 border-t border-border">
            <p className="text-sm leading-relaxed text-foreground/80">{entry.definition}</p>

            {entry.relatedMetrics.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
                  <Link2 className="h-3 w-3" />
                  Related metrics
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {entry.relatedMetrics.map((m) => (
                    <Badge key={m} variant="secondary" className="text-[10px] font-mono px-1.5">
                      {m}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {entry.certifiedBy && (
              <div className="text-xs text-muted-foreground flex gap-3">
                <span>
                  Certified by <span className="font-medium text-foreground">{entry.certifiedBy}</span>
                </span>
                {entry.lastReviewed && (
                  <span>
                    Last reviewed <span className="font-medium text-foreground">{entry.lastReviewed}</span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton placeholder cards
// ─────────────────────────────────────────────────────────────────────────────

function GlossaryCardSkeleton() {
  return (
    <Card>
      <CardHeader className="pb-3 pt-4 px-5">
        <div className="flex items-start gap-3">
          <div className="space-y-2 flex-1">
            <Skeleton className="h-5 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
          <Skeleton className="h-5 w-24 rounded-full" />
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <Skeleton className="h-8 w-full rounded-md" />
      </CardContent>
    </Card>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Main page
// ─────────────────────────────────────────────────────────────────────────────

export function GlossaryPage() {
  const { data: glossaryData, isLoading: isLoadingGlossary } = useGlossary()
  const { data: domainsData, isLoading: isLoadingDomains } = useDomains()

  const [search, setSearch] = useState("")
  const [selectedDomain, setSelectedDomain] = useState<string>("all")
  const [selectedTag, setSelectedTag] = useState<string>("all")
  const [certifiedOnly, setCertifiedOnly] = useState(false)

  const allEntries = glossaryData?.data ?? []
  const allTags = glossaryData?.allTags ?? []
  const domains = domainsData?.data ?? []

  const filtered = useMemo(() => {
    let entries = allEntries
    if (selectedDomain !== "all") {
      entries = entries.filter((e) => e.domain === selectedDomain)
    }
    if (selectedTag !== "all") {
      entries = entries.filter((e) => e.tags.includes(selectedTag))
    }
    if (certifiedOnly) {
      entries = entries.filter((e) => !!e.certifiedBy)
    }
    if (search.trim()) {
      const lower = search.toLowerCase()
      entries = entries.filter(
        (e) =>
          e.term.toLowerCase().includes(lower) ||
          e.shortDefinition.toLowerCase().includes(lower) ||
          e.definition.toLowerCase().includes(lower) ||
          e.tags.some((t) => t.includes(lower)),
      )
    }
    return entries
  }, [allEntries, selectedDomain, selectedTag, certifiedOnly, search])

  const uniqueDomains = [...new Set(allEntries.map((e) => e.domain))]

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6 text-primary" />
            Business Glossary
          </h2>
          <p className="text-muted-foreground text-sm mt-1">
            Canonical definitions for every finance metric and KPI across {uniqueDomains.length} semantic domains.
          </p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Database className="h-4 w-4" />
          <span>{allEntries.length} definitions</span>
          <span className="text-border">·</span>
          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          <span>{allEntries.filter((e) => e.certifiedBy).length} certified</span>
        </div>
      </div>

      {/* Domain stats strip */}
      {isLoadingDomains ? (
        <div className="grid grid-cols-4 xl:grid-cols-8 gap-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      ) : (
        <DomainStatsStrip domains={domains} />
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="Search terms, definitions, tags…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Domain filter */}
        <select
          value={selectedDomain}
          onChange={(e) => setSelectedDomain(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Domains</option>
          {uniqueDomains.map((d) => (
            <option key={d} value={d}>
              {DOMAIN_LABELS[d] ?? d}
            </option>
          ))}
        </select>

        {/* Tag filter */}
        <select
          value={selectedTag}
          onChange={(e) => setSelectedTag(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        >
          <option value="all">All Tags</option>
          {allTags.sort().map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>

        {/* Certified toggle */}
        <button
          onClick={() => setCertifiedOnly((v) => !v)}
          className={cn(
            "h-9 px-3 rounded-md border text-sm font-medium flex items-center gap-2 transition-colors",
            certifiedOnly
              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
              : "border-input bg-background text-muted-foreground hover:text-foreground",
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          Certified only
        </button>
      </div>

      {/* Results count */}
      {!isLoadingGlossary && (
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {allEntries.length} definitions
          {search && <span> matching &ldquo;{search}&rdquo;</span>}
        </p>
      )}

      {/* Entry grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {isLoadingGlossary
          ? Array.from({ length: 6 }).map((_, i) => <GlossaryCardSkeleton key={i} />)
          : filtered.length === 0
          ? (
            <div className="col-span-full">
              <Card className="border-dashed">
                <CardContent className="p-12 text-center text-muted-foreground">
                  <BookOpen className="h-8 w-8 mx-auto mb-3 opacity-30" />
                  <p className="font-medium">No definitions found</p>
                  <p className="text-sm mt-1">Try adjusting your search or filters.</p>
                </CardContent>
              </Card>
            </div>
          )
          : filtered.map((entry) => (
            <GlossaryCard key={entry.slug} entry={entry} />
          ))}
      </div>

      {/* Footer note */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground border-t border-border pt-4">
        <BookOpen className="h-3.5 w-3.5 shrink-0" />
        <span>
          Definitions are derived from the FinanceOS semantic layer (
          <code className="font-mono bg-muted px-1 rounded text-[10px]">
            packages/semantic/glossary.yaml
          </code>
          ) and certified by the CFO Office. Reviewed quarterly.
        </span>
      </div>
    </div>
  )
}

import { useState, useMemo } from "react"
import React from "react"
import { useQuery } from "@tanstack/react-query"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ChevronRight, ChevronDown, TrendingDown, TrendingUp } from "lucide-react"
import { Link } from "wouter"

const BASE = import.meta.env.BASE_URL

async function fetchPlReport() {
  const res = await fetch(`${BASE}api/reporting/pl-report`)
  if (!res.ok) throw new Error("Failed to fetch P&L report")
  return res.json()
}

interface FlatRow {
  gaap_l1: string; gaap_l2: string; gaap_l3: string; gaap_l4: string
  actual: number; budget: number
}

interface TreeNode {
  key: string; label: string; level: number
  actual: number; budget: number
  children: TreeNode[]
}

function cleanLabel(s: string): string {
  return s.replace(/^\d+\s*-\s*/, "").trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
}

function buildTree(rows: FlatRow[]): TreeNode[] {
  const l1Map = new Map<string, TreeNode>()

  for (const row of rows) {
    if (!l1Map.has(row.gaap_l1)) {
      l1Map.set(row.gaap_l1, { key: row.gaap_l1, label: cleanLabel(row.gaap_l1), level: 1, actual: 0, budget: 0, children: [] })
    }
    const l1 = l1Map.get(row.gaap_l1)!

    const l2Key = `${row.gaap_l1}||${row.gaap_l2}`
    let l2 = l1.children.find((c) => c.key === l2Key)
    if (!l2) {
      l2 = { key: l2Key, label: cleanLabel(row.gaap_l2), level: 2, actual: 0, budget: 0, children: [] }
      l1.children.push(l2)
    }

    const l3Key = `${l2Key}||${row.gaap_l3}`
    let l3 = l2.children.find((c) => c.key === l3Key)
    if (!l3) {
      l3 = { key: l3Key, label: cleanLabel(row.gaap_l3), level: 3, actual: 0, budget: 0, children: [] }
      l2.children.push(l3)
    }

    const l4Key = `${l3Key}||${row.gaap_l4}`
    let l4 = l3.children.find((c) => c.key === l4Key)
    if (!l4) {
      l4 = { key: l4Key, label: cleanLabel(row.gaap_l4), level: 4, actual: row.actual, budget: row.budget, children: [] }
      l3.children.push(l4)
    } else {
      l4.actual += row.actual
      l4.budget += row.budget
    }

    l3.actual += row.actual; l3.budget += row.budget
    l2.actual += row.actual; l2.budget += row.budget
    l1.actual += row.actual; l1.budget += row.budget
  }

  return Array.from(l1Map.values())
}

function fmt(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? "-" : ""
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1e9).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}B`
  if (abs >= 1_000_000) return `${sign}$${(abs / 1e6).toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })}M`
  if (abs >= 1_000) return `${sign}$${Math.round(abs / 1_000).toLocaleString()}K`
  return `${sign}$${Math.round(abs).toLocaleString()}`
}

const INDENT: Record<number, string> = { 1: "pl-3", 2: "pl-7", 3: "pl-11", 4: "pl-16" }
const FONT: Record<number, string> = { 1: "font-semibold text-sm", 2: "font-medium text-sm", 3: "text-sm", 4: "text-sm text-foreground/70" }

function renderRows(nodes: TreeNode[], expanded: Set<string>, toggle: (k: string) => void): React.ReactNode {
  return nodes.map((node) => {
    const isOpen = expanded.has(node.key)
    const hasChildren = node.children.length > 0
    const variance = node.actual - node.budget
    const variancePct = node.budget !== 0 ? variance / Math.abs(node.budget) : 0
    const isFav = variance >= 0

    return (
      <React.Fragment key={node.key}>
        <tr
          className={`border-b border-border/40 transition-colors ${node.level === 1 ? "bg-muted/15" : "hover:bg-muted/10"} ${hasChildren ? "cursor-pointer select-none" : ""}`}
          onClick={() => hasChildren && toggle(node.key)}
        >
          <td className={`py-2 pr-4 ${INDENT[node.level]}`}>
            <div className="flex items-center gap-1.5">
              {hasChildren
                ? isOpen
                  ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                : <span className="inline-block w-3.5 shrink-0" />}
              <span className={FONT[node.level]}>{node.label}</span>
            </div>
          </td>
          <td className={`py-2 px-3 text-right tabular-nums text-muted-foreground ${FONT[node.level]}`}>{fmt(node.budget)}</td>
          <td className={`py-2 px-3 text-right tabular-nums ${FONT[node.level]}`}>{fmt(node.actual)}</td>
          <td className={`py-2 px-3 text-right tabular-nums ${isFav ? "text-emerald-400" : "text-red-400"} ${FONT[node.level]}`}>
            <span className="inline-flex items-center gap-1 justify-end">
              {isFav ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {fmt(variance)}
            </span>
          </td>
          <td className={`py-2 px-3 text-right tabular-nums ${isFav ? "text-emerald-400" : "text-red-400"} ${FONT[node.level]}`}>
            {variancePct >= 0 ? "+" : ""}{(variancePct * 100).toFixed(1)}%
          </td>
        </tr>
        {isOpen && hasChildren && renderRows(node.children, expanded, toggle)}
      </React.Fragment>
    )
  })
}

export function PlReportPage() {
  const { data, isLoading } = useQuery({ queryKey: ["pl-report"], queryFn: fetchPlReport })

  const rows: FlatRow[] = data?.data ?? []
  const tree = useMemo(() => buildTree(rows), [rows])

  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  const toggle = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })

  const collectKeys = (nodes: TreeNode[], target: Set<string>) => {
    for (const n of nodes) {
      if (n.children.length > 0) { target.add(n.key); collectKeys(n.children, target) }
    }
  }

  const expandAll = () => { const s = new Set<string>(); collectKeys(tree, s); setExpanded(s) }
  const collapseAll = () => setExpanded(new Set())

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">P&amp;L Report</h1>
          <p className="text-sm text-muted-foreground mt-1">FY2026 YTD · GAAP Hierarchy · Budget vs Actuals</p>
        </div>
        <Link href="/reporting" className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          ← Reporting Center
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">P&amp;L Drilldown — FY2026 YTD</CardTitle>
              <CardDescription>Click any row to expand · GAAP L1 → L4</CardDescription>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <button onClick={expandAll} className="text-primary hover:underline">Expand all</button>
              <span className="text-muted-foreground">·</span>
              <button onClick={collapseAll} className="text-primary hover:underline">Collapse all</button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <div key={i} className="h-8 bg-muted/30 rounded animate-pulse" />)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-muted/5 text-xs text-muted-foreground">
                    <th className="text-left p-3 font-medium">Line Item</th>
                    <th className="text-right p-3 font-medium w-32">Budget</th>
                    <th className="text-right p-3 font-medium w-32">Actual</th>
                    <th className="text-right p-3 font-medium w-32">Variance</th>
                    <th className="text-right p-3 font-medium w-24">Var %</th>
                  </tr>
                </thead>
                <tbody>
                  {renderRows(tree, expanded, toggle)}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

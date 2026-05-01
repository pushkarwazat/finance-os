import { useState } from "react"
import { useListDocuments, useGetDocumentStats } from "@workspace/api-client-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet"
import { FileText, Search, File, HardDrive, Filter, Clock, CheckCircle2, AlertCircle, RefreshCw } from "lucide-react"
import { cn, formatNumber } from "@/lib/utils"

export function DocumentsPage() {
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [selectedDoc, setSelectedDoc] = useState<any | null>(null)

  const { data: stats, isLoading: isLoadingStats } = useGetDocumentStats()
  const { data: docsResponse, isLoading: isLoadingDocs } = useListDocuments()

  const docs = docsResponse?.data || []
  
  const filteredDocs = docs.filter(doc => {
    if (typeFilter !== "all" && doc.type !== typeFilter) return false
    if (search && !doc.title?.toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const getTypeColor = (type: string) => {
    switch (type) {
      case "financial_report": return "bg-indigo-500/10 text-indigo-500 border-indigo-500/20"
      case "contract": return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "memo": return "bg-purple-500/10 text-purple-500 border-purple-500/20"
      case "invoice": return "bg-orange-500/10 text-orange-500 border-orange-500/20"
      default: return "bg-muted text-muted-foreground border-muted"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "indexed": return <CheckCircle2 className="h-3 w-3 text-green-500" />
      case "processing": return <RefreshCw className="h-3 w-3 text-yellow-500 animate-spin" />
      case "error": return <AlertCircle className="h-3 w-3 text-red-500" />
      default: return <Clock className="h-3 w-3 text-muted-foreground" />
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Document Knowledge Base</h2>
        <p className="text-muted-foreground text-sm mt-1">Manage financial documents, contracts, and reports.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Documents</p>
              {isLoadingStats ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-semibold">{stats?.total || 0}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <HardDrive className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Indexed Chunks</p>
              {isLoadingStats ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-semibold">{formatNumber(stats?.totalChunks || 0)}</p>}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <File className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Contracts</p>
              {isLoadingStats ? <Skeleton className="h-7 w-16 mt-1" /> : <p className="text-2xl font-semibold">{stats?.byType?.contract || 0}</p>}
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search documents..." 
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[180px]">
            <div className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              <SelectValue placeholder="Filter type" />
            </div>
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="financial_report">Financial Report</SelectItem>
            <SelectItem value="contract">Contract</SelectItem>
            <SelectItem value="memo">Memo</SelectItem>
            <SelectItem value="invoice">Invoice</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoadingDocs ? (
          Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}><CardContent className="p-5 space-y-3"><Skeleton className="h-5 w-3/4" /><Skeleton className="h-4 w-1/2" /><Skeleton className="h-4 w-full mt-4" /></CardContent></Card>
          ))
        ) : filteredDocs.length === 0 ? (
          <div className="col-span-full py-12 text-center text-muted-foreground border rounded-xl border-dashed">
            No documents found matching your criteria.
          </div>
        ) : (
          filteredDocs.map((doc) => (
            <Card 
              key={doc.id} 
              className="cursor-pointer hover:border-primary/50 transition-colors"
              onClick={() => setSelectedDoc(doc)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <Badge variant="outline" className={cn("capitalize text-[10px] px-1.5 py-0 font-medium", getTypeColor(doc.type || ""))}>
                    {(doc.type || "other").replace("_", " ")}
                  </Badge>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
                    {getStatusIcon(doc.status || "")}
                    <span className="capitalize">{doc.status}</span>
                  </div>
                </div>
                
                <h3 className="font-semibold text-sm line-clamp-2 mb-1 leading-snug" title={doc.title}>
                  {doc.title}
                </h3>
                
                <div className="text-xs text-muted-foreground mt-4 space-y-1.5">
                  <div className="flex justify-between">
                    <span>Uploaded by</span>
                    <span className="font-medium text-foreground">{doc.uploaderName || "System"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Period</span>
                    <span className="font-medium text-foreground">{doc.period} {doc.fiscalYear}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Size</span>
                    <span className="font-medium text-foreground">
                      {doc.chunkCount} chunks • {Math.round((doc.sizeBytes || 0) / 1024)} KB
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Sheet open={!!selectedDoc} onOpenChange={(o) => !o && setSelectedDoc(null)}>
        <SheetContent className="sm:max-w-md overflow-y-auto">
          {selectedDoc && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant="outline" className={cn("capitalize", getTypeColor(selectedDoc.type || ""))}>
                    {(selectedDoc.type || "other").replace("_", " ")}
                  </Badge>
                  <Badge variant="secondary" className="capitalize flex items-center gap-1">
                    {getStatusIcon(selectedDoc.status || "")} {selectedDoc.status}
                  </Badge>
                </div>
                <SheetTitle className="leading-tight">{selectedDoc.title}</SheetTitle>
                <SheetDescription>
                  {selectedDoc.filename}
                </SheetDescription>
              </SheetHeader>

              <div className="space-y-6">
                <div>
                  <h4 className="text-sm font-semibold mb-2">Summary</h4>
                  <div className="bg-muted/50 p-4 rounded-lg text-sm text-muted-foreground leading-relaxed">
                    {selectedDoc.summary || "No summary available for this document."}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-card border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Fiscal Period</p>
                    <p className="font-medium text-sm">{selectedDoc.period} {selectedDoc.fiscalYear}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Uploader</p>
                    <p className="font-medium text-sm">{selectedDoc.uploaderName || "System"}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Chunks</p>
                    <p className="font-medium text-sm">{selectedDoc.chunkCount || 0}</p>
                  </div>
                  <div className="bg-card border rounded-lg p-3">
                    <p className="text-xs text-muted-foreground mb-1">Pages</p>
                    <p className="font-medium text-sm">{selectedDoc.pageCount || "Unknown"}</p>
                  </div>
                </div>

                {selectedDoc.tags && selectedDoc.tags.length > 0 && (
                  <div>
                    <h4 className="text-sm font-semibold mb-2">Tags</h4>
                    <div className="flex flex-wrap gap-2">
                      {selectedDoc.tags.map((tag: string, i: number) => (
                        <Badge key={i} variant="secondary" className="text-xs font-normal">{tag}</Badge>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}

import { useListAskSessions, useSubmitQuestion } from "@workspace/api-client-react"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import { MessageSquare, Send, BookOpen, Bot, User, Loader2 } from "lucide-react"
import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  citations?: any[]
}

export function AskPage() {
  const { data: sessions, isLoading: isLoadingSessions } = useListAskSessions()
  const submitQuestion = useSubmitQuestion()
  
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hello. I'm your Finance AI Assistant. I can help analyze metrics, explain variances, and query your financial documents. What would you like to know?"
    }
  ])
  const [input, setInput] = useState("")
  const [activeSessionId, setActiveSessionId] = useState<string | undefined>()
  
  const scrollRef = useRef<HTMLDivElement>(null)
  
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || submitQuestion.isPending) return
    
    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: input
    }
    
    setMessages(prev => [...prev, userMessage])
    setInput("")
    
    submitQuestion.mutate(
      { data: { question: userMessage.content, sessionId: activeSessionId } },
      {
        onSuccess: (data) => {
          if (data.sessionId && !activeSessionId) {
            setActiveSessionId(data.sessionId)
          }
          
          setMessages(prev => [...prev, {
            id: data.messageId || Date.now().toString(),
            role: "assistant",
            content: data.answer,
            citations: data.citations
          }])
        },
        onError: () => {
          setMessages(prev => [...prev, {
            id: Date.now().toString(),
            role: "assistant",
            content: "Sorry, I encountered an error processing your request. Please try again."
          }])
        }
      }
    )
  }

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6 max-w-7xl mx-auto">
      <Card className="w-64 flex-shrink-0 flex flex-col bg-sidebar/50 border-border">
        <div className="p-4 border-b border-border">
          <Button variant="outline" className="w-full justify-start" onClick={() => {
            setMessages([{
              id: "welcome",
              role: "assistant",
              content: "Hello. I'm your Finance AI Assistant. I can help analyze metrics, explain variances, and query your financial documents. What would you like to know?"
            }])
            setActiveSessionId(undefined)
          }}>
            <MessageSquare className="mr-2 h-4 w-4" />
            New Chat
          </Button>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-2 space-y-1">
            {isLoadingSessions ? (
              <div className="p-4 flex justify-center text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /></div>
            ) : sessions?.data.map((session) => (
              <button
                key={session.id}
                className={`w-full text-left px-3 py-2 text-sm rounded-md hover:bg-accent hover:text-accent-foreground transition-colors truncate ${activeSessionId === session.id ? 'bg-accent text-accent-foreground font-medium' : 'text-muted-foreground'}`}
                onClick={() => setActiveSessionId(session.id)}
              >
                {session.title || "Untitled Session"}
              </button>
            ))}
          </div>
        </ScrollArea>
      </Card>

      <Card className="flex-1 flex flex-col bg-card overflow-hidden">
        <ScrollArea className="flex-1 p-6" ref={scrollRef}>
          <div className="space-y-6 max-w-3xl mx-auto">
            <AnimatePresence initial={false}>
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex gap-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {msg.role === "assistant" && (
                    <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                      <Bot className="h-5 w-5" />
                    </div>
                  )}
                  
                  <div className={`max-w-[80%] ${msg.role === "user" ? "bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3" : "bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-foreground"}`}>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                    
                    {msg.citations && msg.citations.length > 0 && (
                      <div className="mt-4 space-y-2 border-t border-border/50 pt-3">
                        <p className="text-xs font-medium flex items-center text-muted-foreground">
                          <BookOpen className="h-3 w-3 mr-1" /> Sources
                        </p>
                        {msg.citations.map((cit, i) => (
                          <div key={i} className="bg-background/50 border border-border rounded p-2 text-xs">
                            <p className="font-medium mb-1 truncate">{cit.documentTitle}</p>
                            <p className="text-muted-foreground line-clamp-2">{cit.excerpt}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {msg.role === "user" && (
                    <div className="w-8 h-8 rounded bg-secondary flex items-center justify-center text-secondary-foreground flex-shrink-0">
                      <User className="h-5 w-5" />
                    </div>
                  )}
                </motion.div>
              ))}
              {submitQuestion.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4 justify-start"
                >
                  <div className="w-8 h-8 rounded bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                    <Bot className="h-5 w-5" />
                  </div>
                  <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-foreground flex items-center gap-1">
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-1.5 h-1.5 bg-current rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-border bg-card">
          <form onSubmit={handleSubmit} className="max-w-3xl mx-auto relative flex items-center">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about Q3 revenue variance..."
              className="pr-12 bg-background border-border focus-visible:ring-primary h-12 rounded-full"
              disabled={submitQuestion.isPending}
            />
            <Button 
              type="submit" 
              size="icon" 
              variant="ghost" 
              className="absolute right-1 text-primary hover:bg-primary/10 hover:text-primary rounded-full h-10 w-10"
              disabled={!input.trim() || submitQuestion.isPending}
            >
              <Send className="h-5 w-5" />
            </Button>
          </form>
        </div>
      </Card>
    </div>
  )
}

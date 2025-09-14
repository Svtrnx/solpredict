"use client"

import * as React from "react"
import { Check, ChevronsUpDown, Copy, CheckCheck } from "lucide-react"

import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { toast } from "@/hooks/use-toast"
import { cn } from "@/lib/utils"

import type { PythFeedItem } from "@/lib/types/pyth"

interface PythFeedComboboxProps {
  feeds: PythFeedItem[]
  value?: string
  onValueChange?: (value: string) => void
  placeholder?: string
  className?: string
  error?: boolean
}

export function PythFeedCombobox({
  feeds,
  value,
  onValueChange,
  placeholder = "Select trading pair...",
  className,
  error = false,
}: PythFeedComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [copiedId, setCopiedId] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState("")
  const listRef = React.useRef<HTMLDivElement>(null)

  const selectedFeed = React.useMemo(
    () => feeds.find((feed) => feed.id === value) || null,
    [feeds, value]
  )

  const truncateId = (id: string) => {
    if (id.length <= 13) return id
    return `${id.slice(0, 6)}…${id.slice(-6)}`
  }

  const copyToClipboard = async (text: string, e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopiedId(text)
      setTimeout(() => setCopiedId(null), 2000)
      toast({
        title: "Copied!",
        description: "ID copied to clipboard",
      })
    } catch (err) {
      console.error("Failed to copy: ", err)
    }
  }

const filteredFeeds = React.useMemo(() => {
  const q = search.trim().toLowerCase()
  if (!q) return feeds

  const pass = (f: PythFeedItem) => {
    const { base, generic_symbol, display_symbol } = f.attributes
    const b = base.toLowerCase()
    const g = generic_symbol.toLowerCase()
    const d = display_symbol.toLowerCase()
    return b.includes(q) || g.includes(q) || d.includes(q)
  }

  const exactOrPrefixBuckets = (f: PythFeedItem) => {
    const { base, generic_symbol, display_symbol } = f.attributes
    const b = base.toLowerCase()
    const g = generic_symbol.toLowerCase()
    const dBase = display_symbol.toLowerCase().split("/")[0]

    if (b === q || dBase === q) return 0        
    if (b.startsWith(q) || dBase.startsWith(q) || g.startsWith(q)) return 1 
    return 2                                      
  }

  const arr = feeds.filter(pass)

  return arr.sort((x, y) => {
    const bx = exactOrPrefixBuckets(x)
    const by = exactOrPrefixBuckets(y)
    if (bx !== by) return bx - by
    return x.attributes.display_symbol.localeCompare(y.attributes.display_symbol)
  })
}, [feeds, search])


  React.useEffect(() => {
    listRef.current?.scrollTo({ top: 0 })
  }, [search])

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          setSearch("")
          setTimeout(() => listRef.current?.scrollTo({ top: 0 }), 0)
        }
      }}
    >
      <PopoverTrigger asChild>
        <Button
          type="button"  
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "glass h-12 justify-between",
            error ? "border-destructive glow" : "glow-cyan",
            className
          )}
        >
          {selectedFeed ? (
            <div className="flex items-center justify-between w-full">
              <span>{selectedFeed.attributes.display_symbol}</span>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-muted-foreground">
                  {truncateId(selectedFeed.id)}
                </span>
                <span
                  role="button"  
                  // variant="ghost"
                  // size="sm"
                  className="h-4 w-4 p-0 hover:bg-transparent relative"
                  onClick={(e) => copyToClipboard(selectedFeed.id, e)}
                >
                  {copiedId === selectedFeed.id ? (
                    <CheckCheck className="h-3 w-3 text-green-500 animate-in fade-in-0 zoom-in-95 duration-200" />
                  ) : (
                    <Copy className="h-3 w-3" />
                  )}
                </span>
              </div>
            </div>
          ) : (
            placeholder
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>

      <PopoverContent className="w-full p-0 bg-background" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder="Search by base, symbol..."
            className="h-9"
            value={search}
            onValueChange={setSearch}
          />
          <CommandList ref={listRef} className="max-h-[300px] overflow-y-auto dark-scroll">
            <CommandEmpty>No trading pair found.</CommandEmpty>
            <CommandGroup>
              {filteredFeeds.map((feed) => {
                const isSelected = value === feed.id
                return (
                  <CommandItem
                    key={feed.id}
                    value={`${feed.attributes.base} ${feed.attributes.generic_symbol} ${feed.attributes.display_symbol}`}
                    onSelect={() => {
                      onValueChange?.(isSelected ? "" : feed.id)
                      setOpen(false)
                    }}
                    className={cn(
                      "flex items-center justify-between",
                      "hover:bg-secondary/40",                                 
                      "data-[selected=true]:bg-secondary/40",                 
                      "data-[selected=true]:text-foreground",          
                    )}
                  >
                    <div className="flex flex-col">
                      <span className="font-medium">{feed.attributes.display_symbol}</span>
                      <span className="text-xs text-muted-foreground">{feed.attributes.description}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-muted-foreground">{truncateId(feed.id)}</span>
                      <Button
                        type="button"  
                        variant="ghost"
                        size="sm"
                        className="h-4 w-4 p-0 hover:bg-secondary relative"
                        onClick={(e) => copyToClipboard(feed.id, e)}
                      >
                        {copiedId === feed.id ? (
                          <CheckCheck className="h-3 w-3 text-green-500 animate-in fade-in-0 zoom-in-95 duration-200" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                      <Check className={cn("h-4 w-4", isSelected ? "opacity-100" : "opacity-0")} />
                    </div>
                  </CommandItem>
                )
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

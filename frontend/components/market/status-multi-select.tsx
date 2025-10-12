"use client"

import { Check } from "lucide-react"
import * as React from "react"

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Checkbox } from "@/components/ui/checkbox"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const statusOptions = [
  { value: "active", label: "Active" },
  { value: "awaiting_resolve", label: "Awaiting Resolve" },
  { value: "settled_yes", label: "Settled Yes" },
  { value: "settled_no", label: "Settled No" },
  { value: "void", label: "Void" },
]

interface StatusMultiSelectProps {
  value: string[]
  onChange: (value: string[]) => void
  disabled?: boolean
}

export function StatusMultiSelect({ value, onChange, disabled }: StatusMultiSelectProps) {
  const [open, setOpen] = React.useState(false)

  const handleToggle = (statusValue: string) => {
    const newValue = value.includes(statusValue) ? value.filter((v) => v !== statusValue) : [...value, statusValue]
    onChange(newValue)
  }

  const handleSelectAll = () => {
    if (value.length === statusOptions.length) {
      onChange([])
    } else {
      onChange(statusOptions.map((opt) => opt.value))
    }
  }

  const getDisplayText = () => {
    if (value.length === 0) return "All Statuses"
    if (value.length === statusOptions.length) return "All Statuses"
    if (value.length === 1) {
      const selected = statusOptions.find((opt) => opt.value === value[0])
      return selected?.label || "Select status"
    }
    return `${value.length} selected`
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-48 justify-between bg-white/5 border-white/10 text-white hover:bg-white/10"
          disabled={disabled}
        >
          {getDisplayText()}
          <Check className={cn("ml-2 h-4 w-4 shrink-0 opacity-50")} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-48 p-0 bg-background" align="start">
        <div className="p-2 space-y-1">
          <div className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer">
            <Checkbox
              id="select-all"
              checked={value.length === statusOptions.length}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all" className="text-sm font-medium leading-none cursor-pointer flex-1">
              All Statuses
            </label>
          </div>
          <div className="border-t border-border my-1" />
          {statusOptions.map((option) => (
            <div
              key={option.value}
              className="flex items-center space-x-2 px-2 py-1.5 hover:bg-accent rounded-sm cursor-pointer"
            >
              <Checkbox
                id={option.value}
                checked={value.includes(option.value)}
                onCheckedChange={() => handleToggle(option.value)}
              />
              <label htmlFor={option.value} className="text-sm leading-none cursor-pointer flex-1">
                {option.label}
              </label>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  )
}

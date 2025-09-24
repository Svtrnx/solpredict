import { ChevronRight } from "lucide-react"
import { Button } from '@/components/ui/button'

export default function PlaceBetButton() {
    return (
      <>
    <div style={{ width: 300 }} className="flex w-full flex-col gap-2 sm:flex-row sm:gap-4">
      <Button className="group ring-offset-background hover:ring-primary/90 transition-all duration-300 hover:ring-2 hover:ring-offset-2 relative rounded-[0.85rem] h-10">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent rounded-[0.85rem]" />
        <span className="relative z-10">Launch Check</span>
        <ChevronRight style={{marginTop: 0}} className="relative z-10 size-4 shrink-0 transition-all duration-300 ease-out group-hover:translate-x-1" />
      </Button>
    </div>
        </>
  )
}
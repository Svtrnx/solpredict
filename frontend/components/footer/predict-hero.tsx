import { Button } from "@/components/ui/button"
import { ArrowRight, Github } from "lucide-react"

export function PredictHero() {
  return (
    <section className="relative mx-auto max-w-7xl px-6 py-24">
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-amber-900/40 via-rose-900/40 to-purple-900/40 p-12 md:p-16">
        <div className="relative z-10 flex flex-col items-start justify-between gap-12 md:flex-row md:items-center">
          <div className="max-w-2xl">
            <h1 className="mb-6 text-4xl font-bold leading-tight text-white md:text-5xl">
              Ready to use billing components and blocks for your next project?
            </h1>
            <p className="mb-8 text-lg text-white/80">
              Free Billing components and blocks built with React, Typescript, Tailwind CSS, and Motion. Perfect
              companion for shadcn/ui.
            </p>
            <div className="flex flex-wrap gap-4">
              <Button size="lg" className="bg-white text-black hover:bg-white/90">
                Get Started
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="border-white/20 bg-white/5 text-white hover:bg-white/10">
                <Github className="mr-2 h-4 w-4" />
                Github
              </Button>
            </div>
          </div>

          <div className="flex-shrink-0">
            <div className="flex h-32 w-32 items-center justify-center rounded-3xl border border-white/20 bg-black/20 backdrop-blur-sm">
              <svg viewBox="0 0 100 100" className="h-20 w-20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M20 30C20 30 35 25 50 30C65 35 80 30 80 30"
                  stroke="white"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <path
                  d="M20 45C20 45 35 40 50 45C65 50 80 45 80 45"
                  stroke="white"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <path
                  d="M20 60C20 60 35 55 50 60C65 65 80 60 80 60"
                  stroke="white"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                <path
                  d="M20 75C20 75 35 70 50 75C65 80 80 75 80 75"
                  stroke="white"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

import Link from "next/link"

export function GitHubButton() {
  return (
    <div
      data-slot="card"
      className="text-card-foreground gap-6 rounded-xl border py-6 shadow-sm w-full max-w-[280px] md:max-w-xs h-48 cursor-pointer flex flex-col bg-card/50 hover:bg-card/80 transition-all duration-300"
    >
      <Link href="https://github.com/Svtrnx/solpredict" target="_blank" className="flex flex-col h-full">
        <div data-slot="card-content" className="flex flex-col gap-2 items-center justify-center p-6 flex-1">
          <svg
            stroke="currentColor"
            fill="currentColor"
            strokeWidth="0"
            viewBox="0 0 16 16"
            className="text-3xl md:text-4xl text-foreground"
            height="1em"
            width="1em"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8" />
          </svg>
          <p className="text-base font-medium text-foreground">GitHub</p>
        </div>
        <div data-slot="card-footer" className="flex items-center px-4 pb-4 mt-auto">
          <p className="text-xs text-muted-foreground text-center leading-relaxed w-full">
            View our open source code and contribute to the project
          </p>
        </div>
      </Link>
    </div>
  )
}

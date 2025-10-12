import { Github } from "lucide-react"
import Link from "next/link"

export function PredictFooter() {
  return (
    <footer className="border-t border-white/10 bg-black px-6 py-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 md:grid-cols-2 lg:grid-cols-4">
          {/* Brand Section */}
          <div className="lg:col-span-1">
            <div className="mb-4 flex items-center gap-3">
              <svg viewBox="0 0 100 100" className="h-8 w-8" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M20 30C20 30 35 25 50 30C65 35 80 30 80 30"
                  stroke="white"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M20 50C20 50 35 45 50 50C65 55 80 50 80 50"
                  stroke="white"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
                <path
                  d="M20 70C20 70 35 65 50 70C65 75 80 70 80 70"
                  stroke="white"
                  strokeWidth="8"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-xl font-semibold text-white">Billing SDK</span>
            </div>
            <p className="mb-6 text-sm text-white/60">
              Open-source React components for modern billing and subscription management.
            </p>
            <div className="flex gap-4">
              <Link href="#" className="text-white/60 transition-colors hover:text-white">
                <Github className="h-5 w-5" />
              </Link>
              <Link href="#" className="text-white/60 transition-colors hover:text-white">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <circle cx="12" cy="12" r="10" />
                  <circle cx="12" cy="12" r="4" fill="black" />
                </svg>
              </Link>
              <Link href="#" className="text-white/60 transition-colors hover:text-white">
                <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
              </Link>
            </div>
          </div>

          {/* Components */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Components</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  Pricing Tables
                </Link>
              </li>
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  Usage Meters
                </Link>
              </li>
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  Subscription Management
                </Link>
              </li>
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  Banners
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Resources</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  Documentation
                </Link>
              </li>
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  Quick Start
                </Link>
              </li>
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  Theming Guide
                </Link>
              </li>
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  Interfaces
                </Link>
              </li>
            </ul>
          </div>

          {/* Community */}
          <div>
            <h3 className="mb-4 text-sm font-semibold text-white">Community</h3>
            <ul className="space-y-3 text-sm">
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  GitHub Issues
                </Link>
              </li>
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  Discord Server
                </Link>
              </li>
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  Contributing
                </Link>
              </li>
              <li>
                <Link href="#" className="text-white/60 transition-colors hover:text-white">
                  Dodo Payments Github
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="mt-12 border-t border-white/10 pt-8">
          <p className="text-sm text-white/60">
            © 2025 BillingSDK. Made with <span className="text-red-500">❤</span> by developers at Dodo Payments, for
            developers.
          </p>
        </div>
      </div>
    </footer>
  )
}

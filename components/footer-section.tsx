"use client"

import { Twitter, Instagram } from "lucide-react"
import Link from "next/link"

export function FooterSection() {
  return (
    <footer className="w-full max-w-[1320px] mx-auto px-5 flex flex-col py-10 md:py-[70px]">
      <div className="flex flex-col md:flex-row justify-between items-start gap-8 md:gap-0">
        {/* Left Section: Logo, Description, Social Links */}
        <div className="flex flex-col justify-start items-start gap-8 p-4 md:p-8">
          <Link href="/" className="flex gap-3 items-stretch justify-center">
            <div className="text-center text-foreground text-xl font-semibold leading-4">UnfoldK</div>
          </Link>
          <p className="text-foreground/90 text-sm font-medium leading-[18px] text-left">Your Pass to Korean Culture</p>
          <div className="flex justify-start items-start gap-3">
            <a href="#" aria-label="Twitter/X" className="w-4 h-4 flex items-center justify-center">
              <Twitter className="w-full h-full text-muted-foreground" />
            </a>
            <a href="#" aria-label="Instagram" className="w-4 h-4 flex items-center justify-center">
              <Instagram className="w-full h-full text-muted-foreground" />
            </a>
            <a href="#" aria-label="TikTok" className="w-4 h-4 flex items-center justify-center">
              <svg className="w-full h-full text-muted-foreground" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
              </svg>
            </a>
          </div>
        </div>
        {/* Right Section: Services, Company, Legal */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 md:gap-12 p-4 md:p-8 w-full md:w-auto">
          <div className="flex flex-col justify-start items-start gap-3">
            <h3 className="text-muted-foreground text-sm font-medium leading-5">Services</h3>
            <div className="flex flex-col justify-end items-start gap-2">
              <Link href="/calendar" className="text-foreground text-sm font-normal leading-5 hover:underline">
                HallyuCalendar
              </Link>
              <Link href="/kpop" className="text-foreground text-sm font-normal leading-5 hover:underline">
                KpopStats
              </Link>
              <Link href="/drama" className="text-foreground text-sm font-normal leading-5 hover:underline">
                KdramaMatch
              </Link>
              <Link href="/korean" className="text-foreground text-sm font-normal leading-5 hover:underline">
                HangeulGo
              </Link>
              <Link href="/food" className="text-foreground text-sm font-normal leading-5 hover:underline">
                KfoodKit
              </Link>
            </div>
          </div>
          <div className="flex flex-col justify-start items-start gap-3">
            <h3 className="text-muted-foreground text-sm font-medium leading-5">Company</h3>
            <div className="flex flex-col justify-center items-start gap-2">
              <Link href="/about" className="text-foreground text-sm font-normal leading-5 hover:underline">
                About
              </Link>
              <Link href="/blog" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Blog
              </Link>
              <Link href="/careers" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Careers
              </Link>
              <Link href="/contact" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Contact
              </Link>
            </div>
          </div>
          <div className="flex flex-col justify-start items-start gap-3">
            <h3 className="text-muted-foreground text-sm font-medium leading-5">Legal</h3>
            <div className="flex flex-col justify-center items-start gap-2">
              <Link href="/privacy" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Privacy Policy
              </Link>
              <Link href="/terms" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Terms of Use
              </Link>
              <Link href="/cookies" className="text-foreground text-sm font-normal leading-5 hover:underline">
                Cookie Policy
              </Link>
              <Link href="/gdpr" className="text-foreground text-sm font-normal leading-5 hover:underline">
                GDPR
              </Link>
            </div>
          </div>
        </div>
      </div>
      {/* Bottom Line */}
      <div className="w-full border-t border-border mt-8 pt-6 px-4 md:px-8">
        <p className="text-muted-foreground text-sm text-center md:text-left">
          © 2026 UNFOLD LAB · unfoldk.com
        </p>
      </div>
    </footer>
  )
}

"use client"

import Link from "next/link"
import { Check } from "lucide-react"

export default function KBeautyAuthPage() {
  return (
    <div
      className="min-h-screen bg-[#F8F7F5] flex flex-col items-center justify-center px-4 py-16"
      style={{
        fontFamily:
          '"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, system-ui, sans-serif',
      }}
    >
      {/* 로고 */}
      <Link href="/kbeauty" className="flex items-center gap-1 mb-10">
        <span className="font-bold text-[#0F0F0F]">UnfoldK Beauty</span>
        <span className="text-[#C8A882]">&#9670;</span>
      </Link>

      {/* 타이틀 */}
      <h1
        className="text-[#0F0F0F] text-center mb-10"
        style={{
          fontFamily: '"Cormorant Garamond", Georgia, serif',
          fontSize: 32,
          fontWeight: 600,
          lineHeight: 1.2,
        }}
      >
        어떤 분이신가요? / Who are you?
      </h1>

      {/* 카드 3개 */}
      <div className="grid sm:grid-cols-3 gap-5 w-full max-w-[960px]">

        {/* 공급사 카드 (Korean, Navy) */}
        <div
          className="flex flex-col items-start p-8"
          style={{ background: "#1A3A5C", borderRadius: 12 }}
        >
          <span
            className="text-xs font-semibold tracking-widest mb-4"
            style={{ color: "rgba(200,168,130,0.9)" }}
          >
            공급사
          </span>
          <h2 className="text-xl font-bold text-white mb-2">국내 공급사</h2>
          <p className="text-sm mb-6" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
            K-뷰티 제조·브랜드사라면
          </p>
          <ul className="flex flex-col gap-2 mb-8">
            {[
              "검증된 북미 바이어·셀러 연결",
              "FDA 등록 기반 신뢰 배지 제공",
              "국세청 API 사업자 인증으로 빠른 입점",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: "#C8A882" }} />
                <span className="text-xs" style={{ color: "rgba(255,255,255,0.75)", lineHeight: 1.5 }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/kbeauty/supplier"
            className="mt-auto w-full inline-flex items-center justify-center gap-2 font-semibold py-3 px-5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: "#C8A882", color: "#0F0F0F", borderRadius: 8 }}
          >
            공급사 파트너 신청 →
          </Link>
        </div>

        {/* 바이어 카드 (English, Gold) */}
        <div
          className="flex flex-col items-start p-8 border border-[#E8E2DA]"
          style={{ background: "#FDF9F5", borderRadius: 12 }}
        >
          <span
            className="text-xs font-semibold tracking-widest mb-4"
            style={{ color: "#8B6F47" }}
          >
            Buyer
          </span>
          <h2 className="text-xl font-bold text-[#0F0F0F] mb-2">For Global Buyers</h2>
          <p className="text-sm text-[#6B6B6B] mb-6" style={{ lineHeight: 1.6 }}>
            Looking for Korean beauty suppliers?
          </p>
          <ul className="flex flex-col gap-2 mb-8">
            {[
              "Customs data-verified supplier database",
              "FDA-registered Korean manufacturers",
              "Market insight reports (HS 3304·3305·3307)",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#C8A882]" />
                <span className="text-xs text-[#6B6B6B]" style={{ lineHeight: 1.5 }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/kbeauty/buyer/register"
            className="mt-auto w-full inline-flex items-center justify-center gap-2 font-semibold py-3 px-5 rounded-lg transition-colors hover:opacity-90"
            style={{ background: "#C8A882", color: "#0F0F0F", borderRadius: 8 }}
          >
            Get Buyer Access →
          </Link>
        </div>

        {/* 셀러 카드 (English, Gold) */}
        <div
          className="flex flex-col items-start p-8 border border-[#E8E2DA]"
          style={{ background: "#FDF9F5", borderRadius: 12 }}
        >
          <span
            className="text-xs font-semibold tracking-widest mb-4"
            style={{ color: "#8B6F47" }}
          >
            Seller
          </span>
          <h2 className="text-xl font-bold text-[#0F0F0F] mb-2">For Global Sellers</h2>
          <p className="text-sm text-[#6B6B6B] mb-6" style={{ lineHeight: 1.6 }}>
            Amazon, Shopify, TikTok Shop sellers
          </p>
          <ul className="flex flex-col gap-2 mb-8">
            {[
              "Sourcing Sniper — weekly K-beauty trend alerts",
              "Direct match with verified Korean suppliers",
              "FDA-registered manufacturers database",
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#C8A882]" />
                <span className="text-xs text-[#6B6B6B]" style={{ lineHeight: 1.5 }}>
                  {item}
                </span>
              </li>
            ))}
          </ul>
          <Link
            href="/kbeauty/seller/register"
            className="mt-auto w-full inline-flex items-center justify-center gap-2 font-semibold py-3 px-5 rounded-lg transition-colors hover:opacity-90"
            style={{ background: "#C8A882", color: "#0F0F0F", borderRadius: 8 }}
          >
            Get Seller Access →
          </Link>
        </div>
      </div>

      {/* 기존 계정 로그인 링크 */}
      <p className="mt-8 text-sm text-[#6B6B6B]">
        Already have an account?{" "}
        <Link href="/kbeauty/login" className="text-[#1A3A5C] font-medium hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}

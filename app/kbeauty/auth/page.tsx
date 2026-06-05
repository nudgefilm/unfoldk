"use client"

import Link from "next/link"

export default function KBeautyAuthPage() {
  return (
    <div
      className="min-h-screen bg-[#F8F7F5] flex flex-col items-center justify-center px-4"
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

      {/* 카드 2개 */}
      <div className="grid sm:grid-cols-2 gap-5 w-full max-w-[680px]">

        {/* 공급사 카드 */}
        <div
          className="flex flex-col items-start p-8"
          style={{
            background: "#1A3A5C",
            borderRadius: 12,
          }}
        >
          <span
            className="text-xs font-semibold tracking-widest mb-4"
            style={{ color: "rgba(200,168,130,0.9)" }}
          >
            SUPPLIER
          </span>
          <h2 className="text-xl font-bold text-white mb-2">공급사</h2>
          <p className="text-sm mb-8" style={{ color: "rgba(255,255,255,0.65)", lineHeight: 1.6 }}>
            국내 K-뷰티 공급사라면
          </p>
          <Link
            href="/kbeauty/supplier"
            className="mt-auto w-full inline-flex items-center justify-center gap-2 font-semibold py-3 px-5 rounded-lg transition-opacity hover:opacity-80"
            style={{ background: "#C8A882", color: "#0F0F0F", borderRadius: 8 }}
          >
            공급사 파트너 신청
            <span className="text-lg">&#8594;</span>
          </Link>
        </div>

        {/* 바이어 카드 */}
        <div
          className="flex flex-col items-start p-8 border border-[#E8E2DA]"
          style={{
            background: "#FDF9F5",
            borderRadius: 12,
          }}
        >
          <span
            className="text-xs font-semibold tracking-widest mb-4"
            style={{ color: "#8B6F47" }}
          >
            BUYER
          </span>
          <h2 className="text-xl font-bold text-[#0F0F0F] mb-2">Buyer</h2>
          <p className="text-sm text-[#6B6B6B] mb-8" style={{ lineHeight: 1.6 }}>
            Looking for Korean beauty suppliers?
          </p>
          <Link
            href="/kbeauty/buyer/register"
            className="mt-auto w-full inline-flex items-center justify-center gap-2 font-semibold py-3 px-5 rounded-lg transition-colors hover:opacity-90"
            style={{
              background: "#C8A882",
              color: "#0F0F0F",
              borderRadius: 8,
            }}
          >
            Get Buyer Access
            <span className="text-lg">&#8594;</span>
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

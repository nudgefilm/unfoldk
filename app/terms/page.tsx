"use client"

import { useState } from "react"
import { FooterSection } from "@/components/footer-section"

export default function TermsPage() {
  const [language, setLanguage] = useState<"en" | "ko">("en")

  return (
    <div className="min-h-screen bg-background">
      <main className="max-w-[800px] mx-auto px-5 py-16 md:py-24">
        {/* Title */}
        <h1 className="text-4xl md:text-5xl font-bold text-white text-center mb-3">
          {language === "en" ? "Terms of Use" : "이용약관"}
        </h1>
        <p className="text-muted-foreground text-center mb-8">
          {language === "en" ? "Last updated: May 10, 2026" : "최종 수정일: 2026년 5월 10일"}
        </p>

        {/* Language Toggle */}
        <div className="flex justify-center mb-12">
          <div className="inline-flex bg-[#1a1a1a] rounded-full p-1 border border-border/30">
            <button
              onClick={() => setLanguage("en")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                language === "en"
                  ? "text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={language === "en" ? { backgroundColor: "#FF4B6E" } : {}}
            >
              English
            </button>
            <button
              onClick={() => setLanguage("ko")}
              className={`px-5 py-2 rounded-full text-sm font-medium transition-all ${
                language === "ko"
                  ? "text-white"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              style={language === "ko" ? { backgroundColor: "#FF4B6E" } : {}}
            >
              한국어
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="space-y-6">
          {language === "en" ? (
            <>
              <Section title="1. Acceptance of Terms">
                <p>By creating an account or using UnfoldK, you agree to these Terms. If you do not agree, please do not use the service.</p>
              </Section>

              <Section title="2. Description of Service">
                <p className="mb-3">UnfoldK provides six services for global Hallyu fans:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>HallyuCalendar: K-pop and K-drama event calendar</li>
                  <li>KpopStats: Global artist statistics dashboard</li>
                  <li>KdramaMatch: UnfoldK K-drama recommendations</li>
                  <li>HangeulGo: Korean language learning via K-drama content</li>
                  <li>KfoodKit: K-drama recipe and local ingredient guide</li>
                  <li>Curation K: Filming locations, attractions, and K-Pop pilgrimage map</li>
                </ul>
              </Section>

              <Section title="3. Account Registration">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Provide accurate and complete information</li>
                  <li>You are responsible for account security</li>
                  <li>One account per person — sharing is not permitted</li>
                  <li>Must be 13 years or older</li>
                </ul>
              </Section>

              <Section title="4. Subscription Plans & Billing">
                <div className="space-y-2 text-muted-foreground">
                  <p><strong className="text-foreground">Free Plan:</strong> No payment, limited access</p>
                  <p><strong className="text-foreground">Hallyu Pass Monthly:</strong> $15.00/month</p>
                  <p><strong className="text-foreground">Hallyu Pass Annual:</strong> $120.00/year ($10.00/month)</p>
                  <ul className="list-disc list-inside space-y-1 mt-3">
                    <li>Payments are processed by Lemon Squeezy (lemonsqueezy.com), our Merchant of Record. Lemon Squeezy handles billing, taxes, refunds, and invoices on behalf of UNFOLD LAB.</li>
                    <li>Prices may change with 30 days&apos; notice</li>
                  </ul>
                </div>
              </Section>

              <Section title="5. Cancellation & Refunds">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Cancel anytime from My Page &gt; Subscription</li>
                  <li>Access continues until end of current billing period</li>
                  <li>No refunds for partial periods</li>
                  <li>Annual plan: refund requests within 14 days reviewed case-by-case</li>
                  <li>Contact: support@unfoldk.com</li>
                </ul>
              </Section>

              <Section title="6. Acceptable Use">
                <p className="mb-2">You agree not to:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>Use the service for unlawful purposes</li>
                  <li>Scrape or redistribute content without permission</li>
                  <li>Hack or reverse-engineer the platform</li>
                  <li>Share account credentials</li>
                </ul>
              </Section>

              <Section title="7. User-Submitted Content">
                <p className="mb-2">
                  By submitting images, photos, or any content to UnfoldK (including fan event submissions), you confirm that:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>You own the copyright to the submitted content, or have explicit permission from the copyright holder to share it.</li>
                  <li>You grant UNFOLD LAB a non-exclusive, royalty-free license to display the submitted content on UnfoldK.</li>
                  <li>You are solely responsible for any content you upload. UNFOLD LAB reserves the right to remove content that violates these terms or applicable law.</li>
                </ul>
              </Section>

              <Section title="8. Intellectual Property">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>UnfoldK content and design are owned by UNFOLD LAB</li>
                  <li>&quot;This product uses the TMDB API but is not endorsed or certified by TMDB.&quot;</li>
                </ul>
              </Section>

              <Section title="9. Disclaimer">
                <p>UnfoldK is provided &quot;as is&quot; without warranties of any kind.</p>
              </Section>

              <Section title="10. Limitation of Liability">
                <p>UNFOLD LAB shall not be liable for indirect or consequential damages.</p>
              </Section>

              <Section title="11. Governing Law">
                <p>Governed by the laws of the Republic of Korea.</p>
              </Section>

              <Section title="12. Changes">
                <p>We will notify users of changes via email at least 14 days in advance.</p>
              </Section>

              <Section title="13. Contact">
                <p>support@unfoldk.com · UNFOLD LAB · unfoldk.com</p>
              </Section>
            </>
          ) : (
            <>
              <Section title="1. 약관의 적용">
                <p>UnfoldK 계정을 생성하거나 서비스를 이용함으로써 본 약관에 동의하게 됩니다.</p>
              </Section>

              <Section title="2. 서비스 소개">
                <p className="mb-3">UnfoldK는 해외 한류 팬을 위한 5개의 구독 서비스를 제공합니다:</p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>HallyuCalendar: K팝·K드라마 이벤트 통합 캘린더</li>
                  <li>KpopStats: 글로벌 아티스트 통계 대시보드</li>
                  <li>KdramaMatch: UnfoldK K드라마 추천 서비스</li>
                  <li>HangeulGo: K드라마로 배우는 한국어 학습 플랫폼</li>
                  <li>KfoodKit: K드라마 한식 레시피 및 현지 재료 가이드</li>
                </ul>
              </Section>

              <Section title="3. 계정 가입">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>정확한 정보를 제공해야 합니다</li>
                  <li>계정 보안은 이용자 본인이 책임집니다</li>
                  <li>1인 1계정 원칙 — 계정 공유 불가</li>
                  <li>만 14세 이상만 가입 가능합니다</li>
                </ul>
              </Section>

              <Section title="4. 구독 플랜 및 결제">
                <div className="space-y-2 text-muted-foreground">
                  <p><strong className="text-foreground">무료 플랜:</strong> 결제 없이 제한된 기능 이용</p>
                  <p><strong className="text-foreground">Hallyu Pass 월간:</strong> 월 $15.00</p>
                  <p><strong className="text-foreground">Hallyu Pass 연간:</strong> 연 $120.00 (월 $10.00)</p>
                  <ul className="list-disc list-inside space-y-1 mt-3">
                    <li>결제는 당사의 Merchant of Record(공식 판매처)인 Lemon Squeezy(lemonsqueezy.com)를 통해 처리되며, Lemon Squeezy가 UNFOLD LAB을 대신하여 결제·세금·환불·인보이스를 처리합니다</li>
                    <li>가격 변경 시 30일 전 사전 안내합니다</li>
                  </ul>
                </div>
              </Section>

              <Section title="5. 해지 및 환불">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>마이페이지 &gt; 구독 관리에서 언제든 해지 가능</li>
                  <li>해지 후에도 현재 결제 기간 종료까지 이용 가능</li>
                  <li>이미 결제된 기간에 대한 환불은 제공하지 않습니다</li>
                  <li>연간 플랜: 결제 후 14일 이내 환불 요청은 개별 검토</li>
                  <li>문의: support@unfoldk.com</li>
                </ul>
              </Section>

              <Section title="6. 금지 행위">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>불법적인 목적으로 서비스 이용</li>
                  <li>허가 없이 콘텐츠 스크래핑 또는 재배포</li>
                  <li>플랫폼 해킹 또는 리버스 엔지니어링</li>
                  <li>계정 정보 타인 공유</li>
                </ul>
              </Section>

              <Section title="7. 사용자 제출 콘텐츠">
                <p className="mb-2">
                  이미지, 사진 등 UnfoldK에 콘텐츠를 제출(팬 이벤트 신청 포함)함으로써 다음 사항에 동의합니다:
                </p>
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>제출하는 콘텐츠의 저작권을 보유하고 있거나, 저작권자로부터 명시적 허가를 받았음을 확인합니다.</li>
                  <li>UNFOLD LAB에 해당 콘텐츠를 UnfoldK에 표시할 수 있는 비독점적·무상 라이선스를 부여합니다.</li>
                  <li>업로드한 콘텐츠에 대한 책임은 전적으로 사용자에게 있으며, UNFOLD LAB은 본 약관 또는 관련 법령을 위반하는 콘텐츠를 삭제할 권리를 보유합니다.</li>
                </ul>
              </Section>

              <Section title="8. 지식재산권">
                <ul className="list-disc list-inside space-y-1 text-muted-foreground">
                  <li>UnfoldK 콘텐츠 및 디자인은 UNFOLD LAB 소유</li>
                  <li>&quot;본 서비스는 TMDB API를 활용하나 TMDB의 공식 인증을 받지 않았습니다.&quot;</li>
                </ul>
              </Section>

              <Section title="9. 면책 조항">
                <p>UnfoldK는 &quot;있는 그대로&quot; 제공되며 어떠한 보증도 제공하지 않습니다.</p>
              </Section>

              <Section title="10. 책임 제한">
                <p>UNFOLD LAB은 서비스 이용으로 인한 간접적 손해에 대해 책임지지 않습니다.</p>
              </Section>

              <Section title="11. 준거법 및 관할">
                <p>본 약관은 대한민국 법률에 따르며, 분쟁 시 대한민국 법원을 관할로 합니다.</p>
              </Section>

              <Section title="12. 약관 변경">
                <p>중요한 변경 사항은 적용 14일 전 이메일로 안내합니다.</p>
              </Section>

              <Section title="13. 문의">
                <p>support@unfoldk.com · UNFOLD LAB · unfoldk.com</p>
              </Section>
            </>
          )}
        </div>
      </main>

      <FooterSection />
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#1a1a1a] border border-border/30 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-white mb-3">{title}</h2>
      <div className="text-muted-foreground leading-relaxed">{children}</div>
    </div>
  )
}

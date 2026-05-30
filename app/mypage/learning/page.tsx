import { redirect } from "next/navigation"

// /mypage/learning → /mypage/learning-progress 로 영구 리디렉트
// 구형 사이드바 링크·북마크 대응
export default function MyLearningPage() {
  redirect("/mypage/learning-progress")
}

-- =============================================================
-- 0058 — drama_items: "Shop this drama" 기능 (KdramaMatch 드라마별 쇼핑 아이템)
-- 적용: Supabase Dashboard > SQL Editor 에서 전체 실행
-- =============================================================

-- ── 테이블 생성 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS drama_items (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  drama_id      uuid        NOT NULL REFERENCES dramas(id) ON DELETE CASCADE,
  name          text        NOT NULL,
  name_ko       text,
  category      text        NOT NULL CHECK (category IN ('fashion', 'beauty', 'lifestyle')),
  brand         text,
  description   text,
  description_ko text,
  purchase_url  text,
  is_approved   boolean     NOT NULL DEFAULT false,
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- ── 인덱스 ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS drama_items_drama_id_idx   ON drama_items (drama_id);
CREATE INDEX IF NOT EXISTS drama_items_approved_idx   ON drama_items (is_approved);

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE drama_items ENABLE ROW LEVEL SECURITY;

-- 공개 read: is_approved = true 아이템만 (anon 포함)
CREATE POLICY IF NOT EXISTS "drama_items_select_approved"
  ON drama_items FOR SELECT
  USING (is_approved = true);

-- 어드민/서비스 롤 전체 접근 — service_role 은 RLS 우회하므로 별도 정책 불필요

-- ── 권한 부여 ─────────────────────────────────────────────────
GRANT SELECT ON drama_items TO anon, authenticated;
GRANT ALL    ON drama_items TO service_role;

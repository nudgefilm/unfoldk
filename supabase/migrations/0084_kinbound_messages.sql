-- K-Inbound 실시간 채팅 (GLOBAL COMMS)
CREATE TABLE IF NOT EXISTS kinbound_messages (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  message      text        NOT NULL CHECK (char_length(message) BETWEEN 1 AND 100),
  city         text        NOT NULL DEFAULT '',
  country_code text        NOT NULL DEFAULT '',
  created_at   timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE kinbound_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kinbound_select_all" ON kinbound_messages
  FOR SELECT USING (true);

CREATE POLICY "kinbound_insert_all" ON kinbound_messages
  FOR INSERT WITH CHECK (char_length(message) BETWEEN 1 AND 100);

-- Realtime 활성화
ALTER PUBLICATION supabase_realtime ADD TABLE kinbound_messages;

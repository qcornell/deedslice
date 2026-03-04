-- AI usage tracking
CREATE TABLE IF NOT EXISTS ai_usage_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE ai_usage_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own AI usage" ON ai_usage_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own AI usage" ON ai_usage_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Compliance filing date
ALTER TABLE ds_properties ADD COLUMN IF NOT EXISTS filing_due_date DATE;

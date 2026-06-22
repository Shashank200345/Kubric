-- Create investigation_progress table
-- Tracks individual progress steps for each investigation (per-row, not array-based)
CREATE TABLE public.investigation_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  step TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.investigation_progress ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can select their own investigation progress
CREATE POLICY "users_select_own_progress" ON public.investigation_progress
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Policy: authenticated users can insert their own investigation progress
CREATE POLICY "users_insert_own_progress" ON public.investigation_progress
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Grant access to authenticated users
GRANT SELECT, INSERT ON public.investigation_progress TO authenticated;

-- Index for fast lookups by session_id
CREATE INDEX idx_investigation_progress_session_id
  ON public.investigation_progress (session_id);

-- Register realtime channel for investigation progress (reuse existing pattern)
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('investigation:%', 'Per-investigation updates', true)
ON CONFLICT (pattern) DO NOTHING;

-- Trigger to publish progress updates to realtime
CREATE OR REPLACE FUNCTION public.notify_investigation_progress_step()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'investigation:' || NEW.session_id::text,
    'progress_updated',
    row_to_json(NEW)::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER investigation_progress_step_trigger
AFTER INSERT ON public.investigation_progress
FOR EACH ROW
EXECUTE FUNCTION public.notify_investigation_progress_step();

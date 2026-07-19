-- Create commands table for auto-fix pipeline
CREATE TABLE public.commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cluster_name TEXT NOT NULL,
  command TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending, running, success, failed
  output TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;

-- Policy: authenticated users can select their own commands
CREATE POLICY "users_select_own_commands" ON public.commands
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- Policy: authenticated users can insert their own commands
CREATE POLICY "users_insert_own_commands" ON public.commands
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Policy: authenticated users can update their own commands (mostly status/output)
CREATE POLICY "users_update_own_commands" ON public.commands
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.commands TO authenticated;

-- Index for fast lookups by cluster_name and user_id
CREATE INDEX idx_commands_user_cluster
  ON public.commands (user_id, cluster_name);

-- Index for fast lookups by investigation_id
CREATE INDEX idx_commands_investigation_id
  ON public.commands (investigation_id);

-- Register realtime channel for commands (reuse existing pattern)
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('commands:%', 'Per-cluster commands updates', true)
ON CONFLICT (pattern) DO NOTHING;

-- Trigger to publish updates to realtime
CREATE OR REPLACE FUNCTION public.notify_command_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'commands:' || NEW.investigation_id::text,
    'command_updated',
    row_to_json(NEW)::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER command_update_trigger
AFTER INSERT OR UPDATE ON public.commands
FOR EACH ROW
EXECUTE FUNCTION public.notify_command_update();

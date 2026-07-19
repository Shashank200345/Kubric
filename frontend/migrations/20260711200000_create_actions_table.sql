-- Drop the previous commands table
DROP TABLE IF EXISTS public.commands;

-- Create the new actions table
CREATE TABLE public.actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  investigation_id UUID NOT NULL REFERENCES public.investigations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  cluster_name TEXT NOT NULL,

  action_type TEXT NOT NULL CHECK (
    action_type IN ('restart_pod', 'rollback_deployment', 'update_resource_limits', 'scale_deployment')
  ),
  params JSONB NOT NULL,

  status TEXT NOT NULL DEFAULT 'pending' CHECK (
    status IN ('pending', 'in_progress', 'success', 'failed')
  ),
  output JSONB,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.actions ENABLE ROW LEVEL SECURITY;

-- Users can only see/insert actions tied to their own user_id
CREATE POLICY "actions_select_own" ON public.actions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "actions_insert_own" ON public.actions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Grant access to authenticated users
GRANT SELECT, INSERT, UPDATE ON public.actions TO authenticated;

-- Register realtime channel for actions (reuse existing pattern)
INSERT INTO realtime.channels (pattern, description, enabled)
VALUES ('actions:%', 'Per-cluster actions updates', true)
ON CONFLICT (pattern) DO NOTHING;

-- Trigger to publish updates to realtime
CREATE OR REPLACE FUNCTION public.notify_action_update()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM realtime.publish(
    'actions:all',
    'actions_updated',
    row_to_json(NEW)::jsonb
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER action_update_trigger
AFTER INSERT OR UPDATE ON public.actions
FOR EACH ROW
EXECUTE FUNCTION public.notify_action_update();

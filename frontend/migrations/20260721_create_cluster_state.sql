-- Cluster state snapshots pushed by the in-cluster agent (push architecture).
-- The dashboard read endpoints serve from the latest snapshot per (user, cluster)
-- instead of the backend running kubectl directly against the cluster.
CREATE TABLE public.cluster_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  cluster_name TEXT NOT NULL,
  pods JSONB NOT NULL DEFAULT '[]',
  nodes JSONB NOT NULL DEFAULT '[]',
  workloads JSONB NOT NULL DEFAULT '[]',
  events JSONB NOT NULL DEFAULT '[]',
  metrics JSONB NOT NULL DEFAULT '{}',
  logs JSONB NOT NULL DEFAULT '{}',
  collected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, cluster_name)
);

-- Enable RLS
ALTER TABLE public.cluster_state ENABLE ROW LEVEL SECURITY;

-- Users can read only their own cluster state
CREATE POLICY "users_select_own_cluster_state" ON public.cluster_state
  FOR SELECT TO authenticated
  USING (user_id = auth.uid());

GRANT SELECT ON public.cluster_state TO authenticated;

CREATE INDEX idx_cluster_state_user_cluster
  ON public.cluster_state (user_id, cluster_name);

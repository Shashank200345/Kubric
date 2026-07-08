CREATE TABLE IF NOT EXISTS clusters (
    cluster_token UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    cluster_name TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

ALTER TABLE clusters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own clusters"
    ON clusters FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own clusters"
    ON clusters FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own clusters"
    ON clusters FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own clusters"
    ON clusters FOR DELETE
    USING (auth.uid() = user_id);

-- Optional: Insert a test token for our current minikube testing
-- Replace 'DEFAULT_USER_ID' with a real user_id from auth.users if you have one.
-- INSERT INTO clusters (cluster_token, user_id, cluster_name) VALUES ('00000000-0000-0000-0000-000000000000', 'DEFAULT_USER_ID', 'minikube');

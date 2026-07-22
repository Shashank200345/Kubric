-- Migration: Create user_onboarding table for onboarding wizard state persistence
-- References: Requirements 9.1, 9.3, 13.1, 13.2, 14.2, 14.3

-- Create the user_onboarding table
CREATE TABLE IF NOT EXISTS user_onboarding (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id),
    current_step TEXT NOT NULL DEFAULT 'welcome',
    cluster_name TEXT,
    connection_method TEXT CHECK (connection_method IN ('web_token', 'cli')),
    trust_mode TEXT NOT NULL DEFAULT 'approve' CHECK (trust_mode IN ('suggest', 'approve', 'auto')),
    invited_emails JSONB DEFAULT '[]'::jsonb,
    completed_steps JSONB DEFAULT '[]'::jsonb,
    step_timestamps JSONB DEFAULT '{}'::jsonb,
    is_complete BOOLEAN NOT NULL DEFAULT false,
    skipped BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS Policies: Users can only access their own onboarding record
CREATE POLICY "Users can view their own onboarding"
    ON user_onboarding FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own onboarding"
    ON user_onboarding FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own onboarding"
    ON user_onboarding FOR UPDATE
    USING (auth.uid() = user_id);

-- Add last_heartbeat_at column to existing clusters table for heartbeat detection
ALTER TABLE clusters ADD COLUMN IF NOT EXISTS last_heartbeat_at TIMESTAMPTZ;

-- Migration to add evidence_used column to track what the LLM cited
ALTER TABLE public.investigations
ADD COLUMN evidence_used JSONB;

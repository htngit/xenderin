-- Migration: Create teams table for multi-user team management
-- Teams allow staff members to be grouped under a master user

CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  master_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pin TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE public.teams IS 'Teams for grouping staff members under a master user';
COMMENT ON COLUMN public.teams.pin IS 'PIN code for team authentication';
COMMENT ON COLUMN public.teams.master_user_id IS 'Owner of the team';

-- Create indexes for common queries
CREATE INDEX idx_teams_master_user_id ON public.teams(master_user_id);
CREATE INDEX idx_teams_name ON public.teams(name);
CREATE INDEX idx_teams_is_active ON public.teams(is_active);

-- Enable Row Level Security
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Users can view teams belonging to their master account
CREATE POLICY "Users can view own teams"
  ON public.teams FOR SELECT
  USING (
    master_user_id = auth.uid() 
    OR master_user_id IN (
      SELECT master_user_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- RLS Policy: Only master users can insert teams
CREATE POLICY "Master users can insert teams"
  ON public.teams FOR INSERT
  WITH CHECK (
    master_user_id = auth.uid()
  );

-- RLS Policy: Only master users can update their teams
CREATE POLICY "Master users can update own teams"
  ON public.teams FOR UPDATE
  USING (
    master_user_id = auth.uid()
  );

-- RLS Policy: Only master users can delete their teams
CREATE POLICY "Master users can delete own teams"
  ON public.teams FOR DELETE
  USING (
    master_user_id = auth.uid()
  );

-- Create trigger for updated_at
CREATE TRIGGER update_teams_updated_at
  BEFORE UPDATE ON public.teams
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

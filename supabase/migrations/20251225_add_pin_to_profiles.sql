-- Migration: Add PIN column to profiles table
-- Purpose: Allow per-user PIN validation instead of hardcoded '123456'

-- Add pin column with default value
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pin TEXT DEFAULT '123456';

-- Add pin_updated_at column to track PIN changes
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS pin_updated_at TIMESTAMPTZ;

-- Ensure all existing users have the default PIN
UPDATE public.profiles
SET pin = '123456'
WHERE pin IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.profiles.pin IS 'User PIN for authentication (default: 123456)';
COMMENT ON COLUMN public.profiles.pin_updated_at IS 'Timestamp of last PIN update';

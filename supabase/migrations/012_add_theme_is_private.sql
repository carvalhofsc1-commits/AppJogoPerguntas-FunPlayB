-- Migration: Add is_private column to themes table
ALTER TABLE public.themes ADD COLUMN IF NOT EXISTS is_private BOOLEAN DEFAULT FALSE;

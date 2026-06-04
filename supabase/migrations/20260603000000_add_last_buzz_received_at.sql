-- Add last_buzz_received_at column to profiles for server-side push notification rate limiting
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_buzz_received_at TIMESTAMP WITH TIME ZONE;

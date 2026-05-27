-- Add a subscription_tier column to the profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'free';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT false;

-- Optionally, you can add an index to speed up queries by premium status
CREATE INDEX IF NOT EXISTS idx_profiles_is_premium ON public.profiles(is_premium);

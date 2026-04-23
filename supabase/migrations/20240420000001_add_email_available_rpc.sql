-- 1. Addition to the delete_account cleanup to be extra thorough
-- (Already added DELETE FROM public.profiles in the previous turn)

-- 2. Create is_email_available RPC for signup verification
CREATE OR REPLACE FUNCTION public.is_email_available(p_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN NOT EXISTS (
        SELECT 1 FROM auth.users WHERE email = p_email
    );
END;
$$;

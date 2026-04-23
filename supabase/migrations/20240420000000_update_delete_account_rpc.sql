CREATE OR REPLACE FUNCTION public.delete_account(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    result JSONB;
    v_films TEXT[];
    v_thumbnails TEXT[];
    v_messages TEXT[];
    v_profile_pic TEXT;
BEGIN
    -- 1. Collect storage paths before deletion
    -- Films and thumbnails from the user's films
    SELECT 
        ARRAY_AGG(uri) FILTER (WHERE uri IS NOT NULL),
        ARRAY_AGG(thumbnail) FILTER (WHERE thumbnail IS NOT NULL)
    INTO v_films, v_thumbnails
    FROM public.films
    WHERE creator_id = p_user_id;

    -- Messages (voice/media paths) where the user was the sender
    SELECT ARRAY_AGG(uri) FILTER (WHERE uri IS NOT NULL)
    INTO v_messages
    FROM public.messages
    WHERE sender_id = p_user_id AND uri IS NOT NULL;

    -- Profile picture
    SELECT profile_picture
    INTO v_profile_pic
    FROM public.profiles
    WHERE id = p_user_id;

    -- 2. Clear references in other users' profiles
    UPDATE public.profiles SET partner_id = NULL WHERE partner_id = p_user_id;

    -- 3. Delete related rows manually to prevent foreign key violations
    -- These tables reference profiles(id) and might not have CASCADE enabled
    
    DELETE FROM public.blocked_users WHERE blocker_id = p_user_id OR blocked_id = p_user_id;
    DELETE FROM public.film_likes WHERE user_id = p_user_id;
    DELETE FROM public.film_views WHERE viewer_id = p_user_id;
    DELETE FROM public.message_reactions WHERE user_id = p_user_id;
    DELETE FROM public.partner_requests WHERE sender_id = p_user_id OR receiver_id = p_user_id;
    DELETE FROM public.priority_requests WHERE sender_id = p_user_id OR receiver_id = p_user_id;
    DELETE FROM public.priorities WHERE user_id = p_user_id OR priority_user_id = p_user_id;
    
    -- Cleanup messages (shared data)
    -- Important: messages are often shared. If we delete them here, they vanish for both.
    -- But if the user is deleting their account, their sent messages usually go away.
    -- Received messages also go away because they "belong" to this account.
    DELETE FROM public.messages WHERE sender_id = p_user_id OR receiver_id = p_user_id;
    
    -- Cleanup timelines
    DELETE FROM public.user_timelines WHERE owner_id = p_user_id;
    -- For others' timelines, we set other_user_id to NULL instead of deleting the whole memory
    UPDATE public.user_timelines SET other_user_id = NULL WHERE other_user_id = p_user_id;

    -- Cleanup memory delete requests
    DELETE FROM public.memory_delete_requests WHERE requester_id = p_user_id OR other_user_id = p_user_id;

    -- Cleanup call sessions
    DELETE FROM public.call_sessions WHERE caller_id = p_user_id OR callee_id = p_user_id OR ended_by = p_user_id;

    -- Finally delete films (since they have many dependencies like likes/views handled above)
    DELETE FROM public.films WHERE creator_id = p_user_id;

    -- 3.5 Delete the profile itself
    DELETE FROM public.profiles WHERE id = p_user_id;

    -- 4. Construct the return JSONB for storage cleanup
    result := jsonb_build_object(
        'films', COALESCE(v_films, '{}'::TEXT[]),
        'thumbnails', COALESCE(v_thumbnails, '{}'::TEXT[]),
        'messages', COALESCE(v_messages, '{}'::TEXT[]),
        'profile_pic', v_profile_pic
    );

    RETURN result;
END;
$$;


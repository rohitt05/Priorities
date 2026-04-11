// src/services/callService.ts

import { supabase } from '@/lib/supabase'; // same import you use everywhere

// ─── STEP A + B combined: Start a call ─────────────────────────────────────
// Call this when the user taps the phone/video icon on someone's profile
export async function startCall(
    currentUserId: string,
    otherUserId: string,
    callType: 'voice' | 'video'
) {
    // STEP A — Create the call session row in your DB
    const { data: session, error: sessionError } = await supabase
        .from('call_sessions')
        .insert({
            room_name: `call_${Date.now()}_${currentUserId}`,
            caller_id: currentUserId,
            callee_id: otherUserId,
            call_type: callType,
            // status defaults to 'ringing' automatically (set in your DB schema)
        })
        .select('id, room_name')
        .single();

    if (sessionError || !session) {
        throw new Error('Could not create call session');
    }

    // STEP B — Get LiveKit token from your deployed Edge Function
    const { data, error: tokenError } = await supabase.functions.invoke('livekit-token', {
        body: {
            room_name: session.room_name,
            call_session_id: session.id,
        },
    });

    if (tokenError || !data?.token) {
        throw new Error('Could not get call token');
    }

    return {
        sessionId: session.id,
        roomName: session.room_name,
        token: data.token,           // LiveKit JWT — pass to LiveKit SDK
        livekitUrl: data.livekit_url, // wss://... — pass to LiveKit SDK
    };
}

// ─── Callee accepts the call ────────────────────────────────────────────────
// Call this when the callee taps ACCEPT on the incoming call screen
export async function acceptCall(roomName: string, callSessionId: string) {
    const { data, error } = await supabase.functions.invoke('livekit-token', {
        body: {
            room_name: roomName,
            call_session_id: callSessionId,
        },
    });

    if (error || !data?.token) {
        throw new Error('Could not get call token');
    }

    // Also mark the call as active + set answered_at
    await supabase
        .from('call_sessions')
        .update({ status: 'active', answered_at: new Date().toISOString() })
        .eq('id', callSessionId);

    return {
        token: data.token,
        livekitUrl: data.livekit_url,
    };
}

// ─── Either side declines ────────────────────────────────────────────────────
export async function declineCall(callSessionId: string) {
    await supabase
        .from('call_sessions')
        .update({ status: 'declined' })
        .eq('id', callSessionId);
}

// ─── Either side ends the call (Step 3) ─────────────────────────────────────
// Leave LiveKit room FIRST in your UI component, THEN call this
export async function endCall(callSessionId: string) {
    const { data, error } = await supabase.functions.invoke('end-call', {
        body: { call_session_id: callSessionId },
    });

    if (error) throw new Error('Could not end call');

    return {
        durationSec: data.duration_sec,  // show "Call ended · 2m 34s"
        messageId: data.message_id,      // the chat message row that was auto-created
    };
}
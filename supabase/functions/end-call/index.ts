import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
    try {
        // 1. Auth check
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        const supabase = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_ANON_KEY")!,
            { global: { headers: { Authorization: authHeader } } }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return new Response(JSON.stringify({ error: "Unauthorized" }), {
                status: 401,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 2. Parse body
        const { call_session_id } = await req.json();
        if (!call_session_id) {
            return new Response(JSON.stringify({ error: "Missing call_session_id" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 3. Fetch session
        const { data: session, error: sessionError } = await supabase
            .from("call_sessions")
            .select("*")
            .eq("id", call_session_id)
            .single();

        if (sessionError || !session) {
            return new Response(JSON.stringify({ error: "Call session not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (session.status === "ended") {
            return new Response(JSON.stringify({ error: "Call already ended" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 4. Calculate duration and update
        const now = new Date();
        let durationSec = 0;
        if (session.answered_at) {
            const start = new Date(session.answered_at);
            durationSec = Math.floor((now.getTime() - start.getTime()) / 1000);
        }

        const { error: updateError } = await supabase
            .from("call_sessions")
            .update({
                status: "ended",
                ended_at: now.toISOString(),
                ended_by: user.id,
                duration_sec: durationSec
            })
            .eq("id", call_session_id);

        if (updateError) throw updateError;

        // 5. Add to user timeline (for both participants)
        // bypass 'messages' table so it doesn't show in chat
        const timelineEntries = [
            {
                owner_id: session.caller_id,
                other_user_id: session.callee_id,
                media_type: session.call_type === 'video' ? 'video_call' : 'voice_call',
                source_id: call_session_id,
                source_type: 'call',
                sender: 'me',
                duration_sec: durationSec,
                created_at: now.toISOString()
            },
            {
                owner_id: session.callee_id,
                other_user_id: session.caller_id,
                media_type: session.call_type === 'video' ? 'video_call' : 'voice_call',
                source_id: call_session_id,
                source_type: 'call',
                sender: 'other',
                duration_sec: durationSec,
                created_at: now.toISOString()
            }
        ];
        
        const { error: timelineError } = await supabase.from('user_timelines').insert(timelineEntries);
        if (timelineError) throw timelineError;

        return new Response(
            JSON.stringify({ 
                duration_sec: durationSec,
                session_id: call_session_id
            }),
            { headers: { "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("end-call error:", err);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});

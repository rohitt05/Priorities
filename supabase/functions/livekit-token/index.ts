import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { AccessToken } from "npm:livekit-server-sdk@2";

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
        const { room_name, call_session_id } = await req.json();
        if (!room_name || !call_session_id) {
            return new Response(JSON.stringify({ error: "Missing room_name or call_session_id" }), {
                status: 400,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 3. Verify user is part of this call session
        const { data: session, error: sessionError } = await supabase
            .from("call_sessions")
            .select("caller_id, callee_id, status")
            .eq("id", call_session_id)
            .eq("room_name", room_name)
            .single();

        if (sessionError || !session) {
            return new Response(JSON.stringify({ error: "Call session not found" }), {
                status: 404,
                headers: { "Content-Type": "application/json" },
            });
        }

        const isParticipant =
            session.caller_id === user.id || session.callee_id === user.id;

        if (!isParticipant) {
            return new Response(JSON.stringify({ error: "You are not part of this call" }), {
                status: 403,
                headers: { "Content-Type": "application/json" },
            });
        }

        if (["ended", "declined", "missed"].includes(session.status)) {
            return new Response(JSON.stringify({ error: "Call is no longer active" }), {
                status: 410,
                headers: { "Content-Type": "application/json" },
            });
        }

        // 4. Generate LiveKit JWT token
        const apiKey = Deno.env.get("LIVEKIT_API_KEY")!;
        const apiSecret = Deno.env.get("LIVEKIT_API_SECRET")!;
        const livekitUrl = Deno.env.get("LIVEKIT_URL")!;

        const token = new AccessToken(apiKey, apiSecret, {
            identity: user.id,
            ttl: "10m",
        });

        token.addGrant({
            room: room_name,
            roomJoin: true,
            canPublish: true,
            canSubscribe: true,
            canPublishData: true,
        });

        const jwt = await token.toJwt();

        return new Response(
            JSON.stringify({ token: jwt, livekit_url: livekitUrl }),
            { headers: { "Content-Type": "application/json" } }
        );

    } catch (err) {
        console.error("livekit-token error:", err);
        return new Response(JSON.stringify({ error: "Internal server error" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
        });
    }
});
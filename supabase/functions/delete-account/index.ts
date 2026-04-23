import { createClient } from "https://esm.sh/@supabase/supabase-js@2.42.0";

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
    // 1. Handle CORS Preflight
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log("Edge Function invoked. Method:", req.method);

        // 2. Verify JWT / Auth
        const authHeader = req.headers.get("Authorization");
        if (!authHeader) {
            console.error("No authorization header found");
            return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const supabaseUrl = Deno.env.get("SUPABASE_URL");
        const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
        const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

        if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
            console.error("Missing environment variables:", { 
                url: !!supabaseUrl, 
                anon: !!supabaseAnonKey, 
                service: !!supabaseServiceKey 
            });
            return new Response(JSON.stringify({ error: "Server configuration error" }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
            global: { headers: { Authorization: authHeader } },
            auth: { persistSession: false }
        });

        const { data: { user }, error: authError } = await authSupabase.auth.getUser();
        if (authError || !user) {
            console.error("Auth verification failed:", authError);
            return new Response(JSON.stringify({ error: "Unauthorized", details: authError?.message }), {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        const userId = user.id;
        console.log(`Starting account deletion workflow for user: ${userId}`);

        // 3. Service role client for admin/private operations
        const adminSupabase = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false }
        });

        // 4. Call RPC delete_account(userId)
        console.log("Invoking SQL RPC delete_account...");
        const { data: paths, error: rpcError } = await adminSupabase.rpc('delete_account', {
            p_user_id: userId
        });

        if (rpcError) {
            console.error("SQL RPC returned an error:", rpcError);
            return new Response(JSON.stringify({ error: "Database cleanup failed", details: rpcError.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("SQL RPC successful. Collected paths:", JSON.stringify(paths));

        // 5. Delete Auth User (Cascades to Profiles)
        console.log("Deleting user from auth.users...");
        const { error: deleteUserError } = await adminSupabase.auth.admin.deleteUser(userId);

        if (deleteUserError) {
            console.error("Auth user deletion failed:", deleteUserError);
            return new Response(JSON.stringify({ error: "Auth user deletion failed", details: deleteUserError.message }), {
                status: 500,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
            });
        }

        console.log("Auth user deletion successful. Finalizing best-effort storage cleanup...");

        // 6. Best-effort storage cleanup
        const cleanupStorage = async () => {
            const { films, thumbnails, messages, profile_pic } = paths || {};

            // Cleanup Films Bucket
            const filmFiles = [
                ...(Array.isArray(films) ? films : []),
                ...(Array.isArray(thumbnails) ? thumbnails : [])
            ].filter(path => typeof path === 'string' && path.length > 0);

            if (filmFiles.length > 0) {
                console.log(`Cleaning up ${filmFiles.length} files in 'films' bucket`);
                const { error: storageError } = await adminSupabase.storage
                    .from('films')
                    .remove(filmFiles);
                if (storageError) console.error("Films storage error:", storageError.message);
            }

            // Cleanup Messages Bucket
            const messageFiles = (Array.isArray(messages) ? messages : [])
                .filter(path => typeof path === 'string' && path.length > 0);
                
            if (messageFiles.length > 0) {
                console.log(`Cleaning up ${messageFiles.length} files in 'messages' bucket`);
                const { error: storageError } = await adminSupabase.storage
                    .from('messages')
                    .remove(messageFiles);
                if (storageError) console.error("Messages storage error:", storageError.message);
            }

            // Cleanup Profile Pictures Bucket
            if (profile_pic && typeof profile_pic === 'string') {
                console.log(`Cleaning up profile picture: ${profile_pic}`);
                const { error: storageError } = await adminSupabase.storage
                    .from('profile-pictures')
                    .remove([profile_pic]);
                if (storageError) console.error("Profile pic storage error:", storageError.message);
            }
        };

        // Execute cleanup
        await cleanupStorage().catch(err => console.error("Cleanup internal catch:", err));

        console.log("Account deletion workflow finished successfully.");
        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err) {
        console.error("UNCAUGHT EXCEPTION in Edge Function:", err);
        return new Response(JSON.stringify({ 
            error: "Internal server error", 
            details: err instanceof Error ? err.message : String(err) 
        }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});



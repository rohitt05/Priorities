import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

// Replace with your RevenueCat Webhook Auth Token to verify requests
const REVENUECAT_AUTH_TOKEN = Deno.env.get('REVENUECAT_AUTH_TOKEN') || 'your-auth-token';

serve(async (req) => {
    // 1. Verify Authentication Header
    const authHeader = req.headers.get('Authorization');
    if (authHeader !== `Bearer ${REVENUECAT_AUTH_TOKEN}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
        });
    }

    try {
        const body = await req.json();
        const event = body.event;
        
        // Supabase client setup
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

        // Map RevenueCat events to premium status
        const appUserId = event.app_user_id; // Usually mapped to your Supabase User ID
        let isPremium = false;
        let subscriptionTier = 'free';

        if (
            event.type === 'INITIAL_PURCHASE' || 
            event.type === 'RENEWAL' || 
            event.type === 'UNCANCELLATION' ||
            event.type === 'NON_RENEWING_PURCHASE'
        ) {
            isPremium = true;
            subscriptionTier = event.entitlement_id || 'premium';
        } else if (
            event.type === 'CANCELLATION' || 
            event.type === 'EXPIRATION' ||
            event.type === 'BILLING_ISSUE'
        ) {
            isPremium = false;
            subscriptionTier = 'free';
        }

        // Only update if it's a recognized event modifying entitlement
        if (event.type !== 'TEST') {
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    is_premium: isPremium,
                    subscription_tier: subscriptionTier
                })
                .eq('id', appUserId);

            if (error) throw error;
        }

        return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error: any) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        });
    }
});

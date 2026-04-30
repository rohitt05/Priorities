import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// ── Route map for notification taps ─────────────────────────────────────────
// These are Expo Router paths that the app will navigate to when the
// notification is tapped. addNotificationResponseReceivedListener in
// app/_layout.tsx reads `data.route` and calls router.push(data.route).
const ROUTES = {
  MAIN_TABS: '/(tabs)',
  TIMELINES: '/(tabs)/timelines',
} as const;

serve(async (req) => {
  try {
    const payload = await req.json();
    const { table, type, record, old_record } = payload;

    let targetUserId: string | null = null;
    let title = '';
    let body = '';
    let route: string = ROUTES.MAIN_TABS;

    // 1 & 2. Priority Requests
    if (table === 'priority_requests') {
      if (type === 'INSERT') {
        targetUserId = record.receiver_id;
        title = 'New Priority Request';
        body = 'Someone sent you a new priority request.';
        route = ROUTES.MAIN_TABS;
      } else if (type === 'UPDATE' && record.status === 'accepted' && old_record.status !== 'accepted') {
        targetUserId = record.sender_id;
        title = 'Priority Request Accepted';
        body = 'Your priority request was accepted!';
        route = ROUTES.MAIN_TABS;
      }
    }
    // 3. Incoming Call — notification handled by incoming-call screen; skip deep link
    else if (table === 'call_sessions' && type === 'INSERT') {
      targetUserId = record.callee_id;
      title = 'Incoming Call';
      body = 'You have an incoming call.';
      // No route — call listener handles this
    }
    // 4. New Voice Message
    else if (table === 'messages' && type === 'INSERT' && record.type === 'voice') {
      targetUserId = record.receiver_id;
      title = 'New Voice Message';
      body = 'You received a new voice message.';
      route = ROUTES.TIMELINES;
    }
    // 5. Message Reaction
    else if (table === 'message_reactions' && type === 'INSERT') {
      const { data: originalMessage } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('id', record.message_id)
        .single();

      if (originalMessage && originalMessage.sender_id !== record.user_id) {
        targetUserId = originalMessage.sender_id;
        title = 'New Reaction';
        body = 'Someone reacted to your message.';
        route = ROUTES.TIMELINES;
      }
    }
    // 6. Partner Request
    else if (table === 'partner_requests' && type === 'INSERT') {
      targetUserId = record.receiver_id;
      title = 'New Partner Request';
      body = 'You have a new partner request.';
      route = ROUTES.MAIN_TABS;
    }
    // 7. Memory Delete Request
    else if (table === 'memory_delete_requests' && type === 'INSERT') {
      targetUserId = record.other_user_id;
      title = 'Memory Deletion Request';
      body = 'Your partner requested to delete a shared memory.';
      route = ROUTES.TIMELINES;
    }

    console.log(`[Edge Function] Triggered by ${table} / ${type}`);

    if (!targetUserId) {
      console.log('[Edge Function] No target user for this event. Skipping.');
      return new Response(JSON.stringify({ message: 'No notification needed.' }), { status: 200 });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', targetUserId)
      .single();

    if (!profile?.expo_push_token) {
      console.log(`[Edge Function] No push token for ${targetUserId}. Skipping.`);
      return new Response(JSON.stringify({ message: 'User has no push token.' }), { status: 200 });
    }

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };
    if (expoAccessToken) {
      headers['Authorization'] = `Bearer ${expoAccessToken}`;
    }

    const pushPayload: Record<string, unknown> = {
      to: profile.expo_push_token,
      sound: 'default',
      title,
      body,
    };

    // Attach deep-link route so the app can navigate on tap
    // call_sessions notifications intentionally have no route
    if (table !== 'call_sessions') {
      pushPayload.data = { route };
    }

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers,
      body: JSON.stringify(pushPayload),
    });

    const expoData = await expoResponse.json();
    console.log('EXPO RAW RESPONSE:', JSON.stringify(expoData));

    if (expoData?.data?.[0]?.status === 'error') {
      console.error('Expo Push Error Details:', expoData.data[0]);
    }

    return new Response(
      JSON.stringify(expoData),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Internal Edge Function Error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});

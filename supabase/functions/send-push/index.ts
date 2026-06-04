import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const ROUTES = {
  MAIN_TABS: '/(tabs)',
  TIMELINES: '/(tabs)/timelines',
} as const;

async function sendExpoPush(params: {
  token: string;
  title: string;
  body: string;
  data?: Record<string, unknown>;
  sound?: string;
  channelId?: string;
  priority?: string;
  ttl?: number;
}) {
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
    to: params.token,
    sound: params.sound ?? 'default',
    title: params.title,
    body: params.body,
  };
  if (params.data) pushPayload.data = params.data;
  if (params.channelId) pushPayload.channelId = params.channelId;
  if (params.priority) pushPayload.priority = params.priority;
  if (params.ttl !== undefined) pushPayload.ttl = params.ttl;

  const res = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers,
    body: JSON.stringify(pushPayload),
  });

  const json = await res.json();
  if (json?.data?.[0]?.status === 'error') {
    console.error('Expo Push Error:', JSON.stringify(json.data[0]));
  }
  return json;
}

serve(async (req) => {
  try {
    const payload = await req.json();

    if (payload.type === 'buzz') {
      const { receiverId, senderId, senderName } = payload as {
        receiverId: string;
        senderId: string;
        senderName: string;
      };

      if (!receiverId || !senderName) {
        return new Response(
          JSON.stringify({ error: 'receiverId and senderName are required for buzz.' }),
          { status: 400 }
        );
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('expo_push_token, last_buzz_received_at')
        .eq('id', receiverId)
        .single();

      if (!profile?.expo_push_token) {
        return new Response(
          JSON.stringify({ message: 'User has no push token.' }),
          { status: 200 }
        );
      }

      // Sane server-side rate limit throttling (5 seconds) per receiver
      if (profile.last_buzz_received_at) {
        const lastBuzzTime = new Date(profile.last_buzz_received_at).getTime();
        const diff = Date.now() - lastBuzzTime;
        if (diff < 5000) {
          return new Response(
            JSON.stringify({ status: 'throttled', message: 'Throttled to prevent push flood.' }),
            { status: 200, headers: { 'Content-Type': 'application/json' } }
          );
        }
      }

      // Update the last_buzz_received_at timestamp
      await supabase
        .from('profiles')
        .update({ last_buzz_received_at: new Date().toISOString() })
        .eq('id', receiverId);

      const token = profile.expo_push_token as string;

      const result = await sendExpoPush({
        token,
        title: '📳 Buzz!',
        body: `${senderName} is buzzing you`,
        channelId: 'buzz_v2',
        sound: 'buzz.wav',
        priority: 'high',
        ttl: 30,
        data: {
          route: ROUTES.MAIN_TABS,
          type: 'buzz',
          senderId: senderId ?? '',
          senderName: senderName ?? 'Someone',
        },
      });

      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ── DB webhook events ─────────────────────────────────────────────────────
    const { table, type: eventType, record, old_record } = payload;

    let targetUserId: string | null = null;
    let title = '';
    let body = '';
    let route: string = ROUTES.MAIN_TABS;

    if (table === 'priority_requests') {
      if (eventType === 'INSERT') {
        targetUserId = record.receiver_id;
        title = 'New Priority Request';
        body = 'Someone sent you a new priority request.';
        route = ROUTES.MAIN_TABS;
      } else if (eventType === 'UPDATE' && record.status === 'accepted' && old_record.status !== 'accepted') {
        targetUserId = record.sender_id;
        title = 'Priority Request Accepted';
        body = 'Your priority request was accepted!';
        route = ROUTES.MAIN_TABS;
      }
    } else if (table === 'call_sessions' && eventType === 'INSERT') {
      targetUserId = record.callee_id;
      title = 'Incoming Call';
      body = 'You have an incoming call.';
    } else if (table === 'messages' && eventType === 'INSERT' && record.type === 'voice') {
      targetUserId = record.receiver_id;
      title = 'New Voice Message';
      body = 'You received a new voice message.';
      route = ROUTES.TIMELINES;
    } else if (table === 'message_reactions' && eventType === 'INSERT') {
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
    } else if (table === 'partner_requests' && eventType === 'INSERT') {
      targetUserId = record.receiver_id;
      title = 'New Partner Request';
      body = 'You have a new partner request.';
      route = ROUTES.MAIN_TABS;
    } else if (table === 'memory_delete_requests' && eventType === 'INSERT') {
      targetUserId = record.other_user_id;
      title = 'Memory Deletion Request';
      body = 'Your partner requested to delete a shared memory.';
      route = ROUTES.TIMELINES;
    }

    console.log(`[Edge Function] Triggered by ${table} / ${eventType}`);

    if (!targetUserId) {
      console.log('[Edge Function] No target user for this event. Skipping.');
      return new Response(
        JSON.stringify({ message: 'No notification needed.' }),
        { status: 200 }
      );
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', targetUserId)
      .single();

    if (!profile?.expo_push_token) {
      console.log(`[Edge Function] No push token for ${targetUserId}. Skipping.`);
      return new Response(
        JSON.stringify({ message: 'User has no push token.' }),
        { status: 200 }
      );
    }

    const pushData: Record<string, unknown> = {};
    if (table !== 'call_sessions') {
      pushData.route = route;
    }

    const expoData = await sendExpoPush({
      token: profile.expo_push_token,
      title,
      body,
      data: Object.keys(pushData).length > 0 ? pushData : undefined,
    });

    return new Response(
      JSON.stringify(expoData),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Internal Edge Function Error:', error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 400 }
    );
  }
});
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  try {
    const payload = await req.json();
    const { table, type, record, old_record } = payload;
    
    let targetUserId = null;
    let title = "";
    let body = "";

    // 1 & 2. Priority Requests (Table: priority_requests)
    if (table === 'priority_requests') {
      if (type === 'INSERT') {
        targetUserId = record.receiver_id;
        title = "New Priority Request";
        body = "Someone sent you a new priority request.";
      } else if (type === 'UPDATE' && record.status === 'accepted' && old_record.status !== 'accepted') {
        targetUserId = record.sender_id;
        title = "Priority Request Accepted";
        body = "Your priority request was accepted!";
      }
    }
    // 3. Incoming Call (Table: call_sessions)
    else if (table === 'call_sessions' && type === 'INSERT') {
      targetUserId = record.callee_id;
      title = "Incoming Call";
      body = "You have an incoming call.";
    }
    // 4. New Voice Message (Table: messages)
    else if (table === 'messages' && type === 'INSERT' && record.type === 'voice') {
      targetUserId = record.receiver_id;
      title = "New Voice Message";
      body = "You received a new voice message.";
    }
    // 5. Message Reaction (Table: message_reactions)
    else if (table === 'message_reactions' && type === 'INSERT') {
      const { data: originalMessage } = await supabase
        .from('messages')
        .select('sender_id')
        .eq('id', record.message_id)
        .single();
      
      if (originalMessage && originalMessage.sender_id !== record.user_id) {
        targetUserId = originalMessage.sender_id;
        title = "New Reaction";
        body = "Someone reacted to your message.";
      }
    }
    // 6. Partner Request (Table: partner_requests)
    else if (table === 'partner_requests' && type === 'INSERT') {
      targetUserId = record.receiver_id;
      title = "New Partner Request";
      body = "You have a new partner request.";
    }
    // 7. Memory Delete Request (Table: memory_delete_requests)
    else if (table === 'memory_delete_requests' && type === 'INSERT') {
      targetUserId = record.other_user_id;
      title = "Memory Deletion Request";
      body = "Your partner requested to delete a shared memory.";
    }

    console.log(`[Edge Function] Triggered by ${table} with type ${type}`);
    
    if (!targetUserId) {
      console.log("[Edge Function] No target user identified for this event. Skipping.");
      return new Response(JSON.stringify({ message: 'No notification needed.' }), { status: 200 });
    }

    console.log(`[Edge Function] Target User ID determined as: ${targetUserId}`);

    const { data: profile } = await supabase
      .from('profiles')
      .select('expo_push_token')
      .eq('id', targetUserId)
      .single();

    if (!profile) {
      console.log(`[Edge Function] Target user ${targetUserId} DOES NOT EXIST in profiles table!`);
      return new Response(JSON.stringify({ message: 'User not found.' }), { status: 200 });
    }

    if (!profile.expo_push_token) {
      console.log(`[Edge Function] Target user ${targetUserId} HAS NO PUSH TOKEN stored in the database!`);
      return new Response(JSON.stringify({ message: 'User has no push token.' }), { status: 200 });
    }

    console.log(`[Edge Function] Successfully retrieved push token for ${targetUserId}. Sending to Expo...`);

    const expoAccessToken = Deno.env.get('EXPO_ACCESS_TOKEN');
    const headers: Record<string, string> = {
      'Accept': 'application/json',
      'Accept-encoding': 'gzip, deflate',
      'Content-Type': 'application/json',
    };

    if (expoAccessToken) {
      headers['Authorization'] = `Bearer ${expoAccessToken}`;
    }

    const expoResponse = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        to: profile.expo_push_token,
        sound: 'default',
        title: title,
        body: body,
      }),
    });

    const expoData = await expoResponse.json();
    console.log("EXPO RAW RESPONSE:", JSON.stringify(expoData));
    
    // Log if it specifically returned an error in the payload
    if (expoData?.data && expoData.data[0]?.status === 'error') {
      console.error("Expo Push Error Details:", expoData.data[0]);
    }

    return new Response(JSON.stringify(expoData), { status: 200, headers: { 'Content-Type': 'application/json' } });

  } catch (error) {
    console.error("Internal Edge Function Error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
});

import { createClient } from 'npm:@supabase/supabase-js@2.110.5';
import { Temporal } from 'npm:@js-temporal/polyfill@0.5.1';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = new Set(['https://thuissamen.netlify.app', 'http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082', 'http://localhost:8083']);
const reminderMinutes: Record<string, number> = { at_time: 0, min15: 15, min30: 30, hour1: 60, day1: 1440 };

function corsHeaders(request: Request) {
  const origin = request.headers.get('origin') || 'https://thuissamen.netlify.app';
  return {
    'Access-Control-Allow-Origin': allowedOrigins.has(origin) ? origin : 'https://thuissamen.netlify.app',
    'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  };
}

function response(request: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders(request), 'Content-Type': 'application/json' } });
}

async function getConfig() {
  const { data, error } = await admin.from('push_configuration').select('*').eq('id', 1).single();
  if (error) throw error;
  if (data.public_key && data.private_key) return data;
  const keys = webpush.generateVAPIDKeys();
  const { data: saved, error: saveError } = await admin.from('push_configuration')
    .update({ public_key: keys.publicKey, private_key: keys.privateKey, updated_at: new Date().toISOString() })
    .eq('id', 1).select('*').single();
  if (saveError) throw saveError;
  return saved;
}

async function authenticatedFamily(request: Request) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!token) throw new Error('Log eerst in.');
  const { data: userData, error: userError } = await admin.auth.getUser(token);
  if (userError || !userData.user) throw new Error('De sessie is verlopen. Log opnieuw in.');
  const { data: membership, error: membershipError } = await admin.from('family_members')
    .select('family_id').eq('user_id', userData.user.id).maybeSingle();
  if (membershipError) throw membershipError;
  if (!membership) throw new Error('Koppel eerst een gezin.');
  return { user: userData.user, familyId: membership.family_id };
}

function validSubscription(subscription: any) {
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) return false;
  try { return new URL(subscription.endpoint).protocol === 'https:'; } catch { return false; }
}

function monthsBetween(start: Temporal.PlainDate, end: Temporal.PlainDate) {
  return (end.year - start.year) * 12 + end.month - start.month;
}

function recursOn(record: any, candidate: Temporal.PlainDate) {
  let first: Temporal.PlainDate;
  try { first = Temporal.PlainDate.from(record.date); } catch { return false; }
  if (Temporal.PlainDate.compare(candidate, first) < 0) return false;
  if (record.recurrenceUntil && Temporal.PlainDate.compare(candidate, Temporal.PlainDate.from(record.recurrenceUntil)) > 0) return false;
  const type = record.recurrence || 'none';
  if (type === 'none') return candidate.equals(first);
  const days = first.until(candidate, { largestUnit: 'days' }).days;
  if (type === 'daily') return true;
  if (type === 'weekdays') return candidate.dayOfWeek <= 5;
  if (type === 'weekly') return days % 7 === 0;
  if (type === 'biweekly') return days % 14 === 0;
  if (type === 'monthly') {
    const months = monthsBetween(first, candidate);
    return months >= 0 && first.add({ months }).equals(candidate);
  }
  if (type === 'yearly') {
    const years = candidate.year - first.year;
    return years >= 0 && first.add({ years }).equals(candidate);
  }
  if (type === 'custom') {
    const interval = Math.max(1, Number(record.recurrenceInterval || 1));
    if (record.recurrenceUnit === 'weeks') return days % (interval * 7) === 0;
    if (record.recurrenceUnit === 'months') {
      const months = monthsBetween(first, candidate);
      return months >= 0 && months % interval === 0 && first.add({ months }).equals(candidate);
    }
    return days % interval === 0;
  }
  return false;
}

function dueOccurrence(record: any, timezone: string, nowMs: number) {
  if (!record?.date || !record.reminder || record.reminder === 'none' || record.completed || record.deletedAt) return null;
  const minutes = record.reminder === 'custom' ? Math.max(0, Number(record.reminderCustom || 0)) : reminderMinutes[record.reminder];
  if (!Number.isFinite(minutes)) return null;
  let candidate: Temporal.PlainDate;
  try {
    candidate = Temporal.Instant.fromEpochMilliseconds(nowMs + minutes * 60000).toZonedDateTimeISO(timezone).toPlainDate();
  } catch {
    timezone = 'Europe/Amsterdam';
    candidate = Temporal.Instant.fromEpochMilliseconds(nowMs + minutes * 60000).toZonedDateTimeISO(timezone).toPlainDate();
  }
  if (!recursOn(record, candidate)) return null;
  const time = record.allDay ? '09:00' : record.startTime || '09:00';
  let startMs: number;
  try {
    startMs = Number(candidate.toZonedDateTime({ timeZone: timezone, plainTime: Temporal.PlainTime.from(time) }).toInstant().epochMilliseconds);
  } catch { return null; }
  const dueMs = startMs - minutes * 60000;
  if (dueMs < nowMs - 5 * 60000 || dueMs > nowMs + 60000) return null;
  return { date: candidate.toString(), minutes, startMs, timezone };
}

async function reserveDelivery(subscriptionId: string, recordId: string, occurrence: any) {
  const { data: existing, error } = await admin.from('push_delivery_log').select('id,status,attempts,updated_at')
    .eq('subscription_id', subscriptionId).eq('record_id', recordId)
    .eq('occurrence_date', occurrence.date).eq('reminder_minutes', occurrence.minutes).maybeSingle();
  if (error) throw error;
  if (existing?.status === 'sent') return null;
  if (existing?.status === 'processing' && Date.now() - new Date(existing.updated_at).getTime() < 120000) return null;
  if (existing) {
    const { error: updateError } = await admin.from('push_delivery_log').update({
      status: 'processing', attempts: Number(existing.attempts || 0) + 1, error: null, updated_at: new Date().toISOString()
    }).eq('id', existing.id);
    if (updateError) throw updateError;
    return existing.id;
  }
  const { data, error: insertError } = await admin.from('push_delivery_log').insert({
    subscription_id: subscriptionId, record_id: recordId, occurrence_date: occurrence.date,
    reminder_minutes: occurrence.minutes, status: 'processing'
  }).select('id').single();
  if (insertError) {
    if (insertError.code === '23505') return null;
    throw insertError;
  }
  return data.id;
}

async function sendDue(request: Request, cronSecret: string, config: any) {
  if (!cronSecret || cronSecret !== config.cron_secret) return response(request, { error: 'Niet toegestaan.' }, 403);
  webpush.setVapidDetails('mailto:beheer@thuissamen.netlify.app', config.public_key, config.private_key);
  const [{ data: subscriptions, error: subscriptionError }, { data: rows, error: recordError }] = await Promise.all([
    admin.from('push_subscriptions').select('id,family_id,subscription,timezone').eq('active', true),
    admin.from('family_records').select('family_id,record_id,payload').eq('entity_type', 'appointment').is('deleted_at', null)
  ]);
  if (subscriptionError) throw subscriptionError;
  if (recordError) throw recordError;
  const byFamily = new Map<string, any[]>();
  for (const row of rows || []) {
    const list = byFamily.get(row.family_id) || [];
    list.push(row); byFamily.set(row.family_id, list);
  }
  const nowMs = Date.now();
  let sent = 0, failed = 0;
  for (const subscription of subscriptions || []) {
    for (const row of byFamily.get(subscription.family_id) || []) {
      const occurrence = dueOccurrence(row.payload, subscription.timezone, nowMs);
      if (!occurrence) continue;
      const deliveryId = await reserveDelivery(subscription.id, row.record_id, occurrence);
      if (!deliveryId) continue;
      const title = row.payload.title || 'Afspraakherinnering';
      const formatted = new Intl.DateTimeFormat('nl-NL', {
        timeZone: occurrence.timezone, dateStyle: 'medium', ...(row.payload.allDay ? {} : { timeStyle: 'short' })
      }).format(new Date(occurrence.startMs));
      const body = `${row.payload.allDay ? 'Hele dag' : formatted}${row.payload.location ? ` Â· ${row.payload.location}` : ''}`;
      try {
        await webpush.sendNotification(subscription.subscription, JSON.stringify({
          title, body, tag: `afspraak-${row.record_id}-${occurrence.date}`, url: './#agenda'
        }), { TTL: 86400, urgency: 'high' });
        await admin.from('push_delivery_log').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', deliveryId);
        sent += 1;
      } catch (error: any) {
        const message = String(error?.message || error).slice(0, 500);
        await admin.from('push_delivery_log').update({ status: 'failed', error: message, updated_at: new Date().toISOString() }).eq('id', deliveryId);
        if ([404, 410].includes(Number(error?.statusCode))) await admin.from('push_subscriptions').update({ active: false, updated_at: new Date().toISOString() }).eq('id', subscription.id);
        failed += 1;
      }
    }
  }
  await admin.from('push_delivery_log').delete().lt('created_at', new Date(Date.now() - 90 * 86400000).toISOString());
  return response(request, { ok: true, sent, failed, checked: (subscriptions || []).length });
}

async function handleRequest(request: Request) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return response(request, { error: 'Alleen POST is toegestaan.' }, 405);
  try {
    const body = await request.json().catch(() => ({}));
    const config = await getConfig();
    if (body.action === 'send_due') return await sendDue(request, request.headers.get('x-cron-secret') || '', config);
    const { user, familyId } = await authenticatedFamily(request);
    if (body.action === 'config') return response(request, { publicKey: config.public_key });
    if (body.action === 'subscribe') {
      if (!validSubscription(body.subscription)) return response(request, { error: 'Ongeldige pushinschrijving.' }, 400);
      const timezone = typeof body.timezone === 'string' && body.timezone.length < 80 ? body.timezone : 'Europe/Amsterdam';
      const { error } = await admin.from('push_subscriptions').upsert({
        family_id: familyId, user_id: user.id, endpoint: body.subscription.endpoint,
        subscription: body.subscription, timezone, active: true, updated_at: new Date().toISOString()
      }, { onConflict: 'endpoint' });
      if (error) throw error;
      return response(request, { subscribed: true });
    }
    if (body.action === 'unsubscribe') {
      if (typeof body.endpoint !== 'string') return response(request, { error: 'Endpoint ontbreekt.' }, 400);
      const { error } = await admin.from('push_subscriptions').update({ active: false, updated_at: new Date().toISOString() })
        .eq('user_id', user.id).eq('endpoint', body.endpoint);
      if (error) throw error;
      return response(request, { subscribed: false });
    }
    return response(request, { error: 'Onbekende actie.' }, 400);
  } catch (error: any) {
    console.error(error);
    const message = String(error?.message || 'De pushactie is niet gelukt.');
    const status = /log eerst|sessie|koppel eerst/i.test(message) ? 401 : 500;
    return response(request, { error: message }, status);
  }
}

export default { fetch: handleRequest };

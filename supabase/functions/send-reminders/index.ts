import { createClient } from 'npm:@supabase/supabase-js@2.110.5';
import { Temporal } from 'npm:@js-temporal/polyfill@0.5.1';
import webpush from 'npm:web-push@3.6.7';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const allowedOrigins = new Set([
  'https://thuissamen.netlify.app',
  'http://localhost:8080', 'http://localhost:8081', 'http://localhost:8082', 'http://localhost:8083',
  'http://127.0.0.1:8080', 'http://127.0.0.1:8081', 'http://127.0.0.1:8082', 'http://127.0.0.1:8083'
]);
const reminderMinutes: Record<string, number> = { at_time: 0, min15: 15, min30: 30, hour1: 60, day1: 1440 };
const reminderEntityTypes = [
  'appointment', 'task', 'pet', 'inventory', 'outing', 'packing', 'routine', 'maintenance',
  'appliance', 'loan', 'waste', 'babysitting', 'subscription', 'savings_goal', 'visit_plan',
  'reward', 'bucket_list', 'home_project'
];
const FALLBACK_TIMEZONE = 'Europe/Amsterdam';
const WINDOW_BEHIND_MS = 5 * 60 * 1000;
const WINDOW_AHEAD_MS = 65 * 1000;

type DueNotification = {
  date: string;
  minutes: number;
  dueMs: number;
  title: string;
  body: string;
  url: string;
  kind: string;
};

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

function safeTimezone(timezone: string) {
  try {
    Temporal.Now.zonedDateTimeISO(timezone);
    return timezone;
  } catch {
    return FALLBACK_TIMEZONE;
  }
}

function plainDate(value: unknown) {
  try { return Temporal.PlainDate.from(String(value || '').slice(0, 10)); } catch { return null; }
}

function dateAndTime(value: unknown) {
  const text = String(value || '');
  const [date, rawTime = '09:00'] = text.split('T');
  return { date, time: rawTime.slice(0, 5) || '09:00' };
}

function zonedMilliseconds(date: string, time: string, timezone: string) {
  try {
    return Number(Temporal.PlainDate.from(date).toZonedDateTime({
      timeZone: timezone,
      plainTime: Temporal.PlainTime.from(time || '09:00')
    }).toInstant().epochMilliseconds);
  } catch {
    return null;
  }
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

function withinDeliveryWindow(dueMs: number, nowMs: number) {
  return dueMs >= nowMs - WINDOW_BEHIND_MS && dueMs <= nowMs + WINDOW_AHEAD_MS;
}

function notificationAt({
  date, time = '09:00', offsetMinutes = 0, deliveryCode, title, body, url, kind, timezone, nowMs
}: {
  date: string; time?: string; offsetMinutes?: number; deliveryCode: number; title: string;
  body: string; url: string; kind: string; timezone: string; nowMs: number;
}): DueNotification | null {
  const startMs = zonedMilliseconds(date, time, timezone);
  if (startMs === null) return null;
  const dueMs = startMs - offsetMinutes * 60000;
  if (!withinDeliveryWindow(dueMs, nowMs)) return null;
  const dueDate = Temporal.Instant.fromEpochMilliseconds(dueMs).toZonedDateTimeISO(timezone).toPlainDate().toString();
  return { date: dueDate, minutes: deliveryCode, dueMs, title, body, url, kind };
}

function appointmentNotification(record: any, timezone: string, nowMs: number) {
  if (!record?.date || !record.reminder || record.reminder === 'none' || record.completed) return null;
  const minutes = record.reminder === 'custom' ? Math.max(0, Number(record.reminderCustom || 0)) : reminderMinutes[record.reminder];
  if (!Number.isFinite(minutes)) return null;
  const candidate = Temporal.Instant.fromEpochMilliseconds(nowMs + minutes * 60000).toZonedDateTimeISO(timezone).toPlainDate();
  if (!recursOn(record, candidate)) return null;
  const startMs = zonedMilliseconds(candidate.toString(), record.allDay ? '09:00' : record.startTime || '09:00', timezone);
  if (startMs === null) return null;
  const dueMs = startMs - minutes * 60000;
  if (!withinDeliveryWindow(dueMs, nowMs)) return null;
  const formatted = new Intl.DateTimeFormat('nl-NL', {
    timeZone: timezone, dateStyle: 'medium', ...(record.allDay ? {} : { timeStyle: 'short' })
  }).format(new Date(startMs));
  return {
    date: candidate.toString(), minutes, dueMs,
    title: record.title || 'Afspraakherinnering',
    body: `${record.allDay ? 'Hele dag' : formatted}${record.location ? ` · ${record.location}` : ''}`,
    url: './#agenda', kind: record.category === 'Verjaardag' ? 'birthday' : 'appointment'
  };
}

function dueNotifications(entityType: string, record: any, timezoneInput: string, nowMs: number): DueNotification[] {
  if (!record || record.deletedAt) return [];
  const timezone = safeTimezone(timezoneInput);
  const today = Temporal.Instant.fromEpochMilliseconds(nowMs).toZonedDateTimeISO(timezone).toPlainDate();
  const todayText = today.toString();
  const at = (options: Omit<Parameters<typeof notificationAt>[0], 'timezone' | 'nowMs'>) =>
    notificationAt({ ...options, timezone, nowMs });
  const alerts: Array<DueNotification | null> = [];

  if (entityType === 'appointment') alerts.push(appointmentNotification(record, timezone, nowMs));

  if (entityType === 'task' && !['done', 'completed', 'archived'].includes(record.status)) {
    alerts.push(at({ date: record.date, time: record.time || '09:00', deliveryCode: -1001,
      title: `Taak: ${record.title || 'Openstaande taak'}`, body: record.priority ? `Prioriteit: ${record.priority}` : 'Deze taak staat vandaag gepland.',
      url: './#tasks', kind: 'task' }));
  }

  if (entityType === 'pet') {
    if (record.medication && record.medicationTime) {
      alerts.push(at({ date: todayText, time: record.medicationTime, deliveryCode: -1101,
        title: `Medicatie voor ${record.name || 'huisdier'}`, body: `${record.medication}${record.dosage ? ` · ${record.dosage}` : ''}`,
        url: './#pets', kind: 'medication' }));
    }
    if (record.vetAppointment) {
      const appointment = dateAndTime(record.vetAppointment);
      alerts.push(at({ ...appointment, offsetMinutes: 1440, deliveryCode: -1102,
        title: `Morgen naar de dierenarts: ${record.name || 'huisdier'}`, body: record.vet || 'Controleer tijd en benodigdheden.',
        url: './#pets', kind: 'vet' }));
      alerts.push(at({ ...appointment, offsetMinutes: 60, deliveryCode: -1103,
        title: `Over een uur naar de dierenarts: ${record.name || 'huisdier'}`, body: record.vet || 'De afspraak komt eraan.',
        url: './#pets', kind: 'vet' }));
    }
  }

  if (entityType === 'inventory') {
    if (Number(record.quantity) <= Number(record.minimumQuantity)) {
      alerts.push(at({ date: todayText, time: '09:00', deliveryCode: -1201,
        title: `Lage voorraad: ${record.productName || 'product'}`, body: `Nog ${record.quantity ?? 0} ${record.unit || ''} beschikbaar.`,
        url: './#inventory', kind: 'inventory' }));
    }
    const expiry = plainDate(record.expiryDate);
    if (expiry) {
      const days = today.until(expiry, { largestUnit: 'days' }).days;
      if (days === 3) alerts.push(at({ date: todayText, time: '09:00', deliveryCode: -1202,
        title: `Bijna over datum: ${record.productName || 'product'}`, body: 'Nog 3 dagen houdbaar.',
        url: './#inventory', kind: 'expiry' }));
      if (days === 0) alerts.push(at({ date: todayText, time: '09:00', deliveryCode: -1203,
        title: `Vandaag houdbaar: ${record.productName || 'product'}`, body: 'Gebruik dit product vandaag of controleer de houdbaarheid.',
        url: './#inventory', kind: 'expiry' }));
    }
  }

  if (entityType === 'outing' && record.planned && !record.completed) {
    alerts.push(at({ date: record.date, time: '09:00', offsetMinutes: 1440, deliveryCode: -1301,
      title: `Morgen: ${record.name || 'gepland uitje'}`, body: record.location || 'Controleer de planning en benodigdheden.',
      url: './#outings', kind: 'outing' }));
  }

  if (entityType === 'waste' && !record.putOutside) {
    alerts.push(at({ date: record.date, time: record.reminderTime || '20:00', offsetMinutes: 1440, deliveryCode: -2001,
      title: `${record.wasteType || 'Afval'} buitenzetten`, body: `Ophaaldag: ${record.date}`,
      url: './#assistant?module=waste', kind: 'waste' }));
  }
  if (entityType === 'loan' && record.status !== 'returned') {
    alerts.push(at({ date: record.reminder || record.expectedReturnDate, time: '09:00', deliveryCode: -2101,
      title: `${record.item || 'Geleend item'} terugbrengen`, body: record.person || 'De retourdatum is bereikt.',
      url: './#assistant?module=loan', kind: 'loan' }));
  }
  if (entityType === 'maintenance' && !['done', 'archived'].includes(record.status)) {
    alerts.push(at({ date: record.nextDate, time: '09:00', deliveryCode: -2201,
      title: record.title || 'Onderhoud gepland', body: record.location || 'Onderhoud staat vandaag gepland.',
      url: './#assistant?module=maintenance', kind: 'maintenance' }));
  }
  if (entityType === 'appliance' && record.status === 'active' && record.warrantyExpiry) {
    alerts.push(at({ date: record.warrantyExpiry, time: '09:00', offsetMinutes: 30 * 1440, deliveryCode: -2301,
      title: `Garantie verloopt: ${record.name || 'apparaat'}`, body: `Nog 30 dagen tot ${record.warrantyExpiry}.`,
      url: './#assistant?module=appliance', kind: 'warranty' }));
  }
  if (entityType === 'subscription' && record.status === 'active') {
    alerts.push(at({ date: record.trialEndDate, time: '09:00', offsetMinutes: 3 * 1440, deliveryCode: -2401,
      title: `Proefperiode eindigt: ${record.name || 'abonnement'}`, body: 'Beslis binnen 3 dagen of je wilt opzeggen.',
      url: './#assistant?module=subscription', kind: 'subscription' }));
    alerts.push(at({ date: record.contractEndDate, time: '09:00', offsetMinutes: 30 * 1440, deliveryCode: -2402,
      title: `Contract loopt af: ${record.name || 'abonnement'}`, body: 'Controleer de opzegtermijn; nog 30 dagen.',
      url: './#assistant?module=subscription', kind: 'subscription' }));
    if (Number(record.debitDay) === today.day) alerts.push(at({ date: todayText, time: '09:00', deliveryCode: -2403,
      title: `Incasso vandaag: ${record.name || 'abonnement'}`, body: record.amount ? `Verwacht bedrag: € ${record.amount}` : 'Vandaag staat een betaling gepland.',
      url: './#assistant?module=subscription', kind: 'debit' }));
  }
  if (entityType === 'routine' && record.status === 'active' && !record.paused) {
    const weekday = String(today.dayOfWeek % 7);
    if ((record.days || []).map(String).includes(weekday)) alerts.push(at({ date: todayText, time: record.startTime || '09:00', deliveryCode: -2501,
      title: record.title || 'Gezinsroutine', body: 'De routine staat klaar.',
      url: './#routines', kind: 'routine' }));
  }
  if (entityType === 'bucket_list' && !record.completed) {
    alerts.push(at({ date: record.reminder, time: '09:00', deliveryCode: -2601,
      title: record.activity || 'Gezinsbucketlist', body: 'Tijd om dit leuke idee weer te bekijken.',
      url: './#assistant?module=bucket_list', kind: 'bucket' }));
  }
  if (entityType === 'babysitting' && record.startAt) {
    const start = dateAndTime(record.startAt);
    alerts.push(at({ ...start, offsetMinutes: 60, deliveryCode: -2701,
      title: `Oppasmoment over een uur: ${record.title || 'oppas'}`, body: 'Controleer instructies, contactgegevens en benodigdheden.',
      url: './#babysitter', kind: 'babysitting' }));
  }
  if (entityType === 'packing') {
    const items = Array.isArray(record.items) ? record.items : [];
    const complete = items.length > 0 && items.every((item: any) => typeof item === 'object' && (item.checked || item.completed || item.done));
    if (!complete) alerts.push(at({ date: record.date, time: '08:00', deliveryCode: -2801,
      title: `Meeneemlijst: ${record.title || 'controleer de spullen'}`, body: 'De lijst is nog niet volledig afgevinkt.',
      url: './#packing', kind: 'packing' }));
  }
  if (entityType === 'visit_plan' && !['done', 'completed'].includes(record.status)) {
    alerts.push(at({ date: record.date, time: record.time || '09:00', offsetMinutes: 1440, deliveryCode: -2901,
      title: `Morgen bezoek: ${record.title || record.name || 'gezinsbezoek'}`, body: record.location || 'Controleer taken en boodschappen.',
      url: './#assistant?module=visit_plan', kind: 'visit' }));
  }
  if (entityType === 'home_project' && !['done', 'completed', 'archived'].includes(record.status)) {
    alerts.push(at({ date: record.endDate, time: '09:00', offsetMinutes: 1440, deliveryCode: -3001,
      title: `Deadline morgen: ${record.title || 'thuisproject'}`, body: 'Controleer de openstaande stappen.',
      url: './#assistant?module=home_project', kind: 'project' }));
  }
  if (entityType === 'savings_goal' && !record.completed) {
    alerts.push(at({ date: record.targetDate, time: '09:00', offsetMinutes: 7 * 1440, deliveryCode: -3101,
      title: `Spaardoel nadert: ${record.name || 'spaardoel'}`, body: 'Nog één week tot de streefdatum.',
      url: './#assistant?module=savings_goal', kind: 'savings' }));
  }
  if (entityType === 'reward' && record.status === 'active') {
    alerts.push(at({ date: record.endDate, time: '09:00', deliveryCode: -3201,
      title: `Beloningsdoel eindigt vandaag: ${record.title || 'gezinsdoel'}`, body: 'Bekijk samen de voortgang.',
      url: './#assistant?module=reward', kind: 'reward' }));
  }

  return alerts.filter((item): item is DueNotification => Boolean(item));
}

async function reserveDelivery(subscriptionId: string, recordId: string, occurrence: DueNotification) {
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

function setVapid(config: any) {
  webpush.setVapidDetails('mailto:beheer@thuissamen.netlify.app', config.public_key, config.private_key);
}

async function sendDue(request: Request, cronSecret: string, config: any) {
  if (!cronSecret || cronSecret !== config.cron_secret) return response(request, { error: 'Niet toegestaan.' }, 403);
  setVapid(config);
  const [{ data: subscriptions, error: subscriptionError }, { data: rows, error: recordError }] = await Promise.all([
    admin.from('push_subscriptions').select('id,family_id,subscription,timezone').eq('active', true),
    admin.from('family_records').select('family_id,entity_type,record_id,payload')
      .in('entity_type', reminderEntityTypes).is('deleted_at', null)
  ]);
  if (subscriptionError) throw subscriptionError;
  if (recordError) throw recordError;
  const byFamily = new Map<string, any[]>();
  for (const row of rows || []) {
    const list = byFamily.get(row.family_id) || [];
    list.push(row);
    byFamily.set(row.family_id, list);
  }
  const nowMs = Date.now();
  let sent = 0;
  let failed = 0;
  let due = 0;
  for (const subscription of subscriptions || []) {
    for (const row of byFamily.get(subscription.family_id) || []) {
      for (const occurrence of dueNotifications(row.entity_type, row.payload, subscription.timezone, nowMs)) {
        due += 1;
        const deliveryId = await reserveDelivery(subscription.id, row.record_id, occurrence);
        if (!deliveryId) continue;
        try {
          await webpush.sendNotification(subscription.subscription, JSON.stringify({
            title: occurrence.title, body: occurrence.body,
            tag: `${occurrence.kind}-${row.record_id}-${occurrence.date}-${Math.abs(occurrence.minutes)}`,
            url: occurrence.url, kind: occurrence.kind, timestamp: occurrence.dueMs
          }), { TTL: 86400, urgency: ['medication', 'vet', 'appointment', 'birthday'].includes(occurrence.kind) ? 'high' : 'normal' });
          await admin.from('push_delivery_log').update({ status: 'sent', updated_at: new Date().toISOString() }).eq('id', deliveryId);
          sent += 1;
        } catch (error: any) {
          const message = String(error?.message || error).slice(0, 500);
          await admin.from('push_delivery_log').update({ status: 'failed', error: message, updated_at: new Date().toISOString() }).eq('id', deliveryId);
          if ([404, 410].includes(Number(error?.statusCode))) {
            await admin.from('push_subscriptions').update({ active: false, updated_at: new Date().toISOString() }).eq('id', subscription.id);
          }
          failed += 1;
        }
      }
    }
  }
  await admin.from('push_delivery_log').delete().lt('created_at', new Date(Date.now() - 90 * 86400000).toISOString());
  return response(request, { ok: true, sent, failed, due, subscriptions: (subscriptions || []).length });
}

async function sendTest(request: Request, config: any, userId: string, familyId: string, endpoint: unknown) {
  setVapid(config);
  let query = admin.from('push_subscriptions').select('id,subscription').eq('active', true)
    .eq('family_id', familyId).eq('user_id', userId);
  if (typeof endpoint === 'string') query = query.eq('endpoint', endpoint);
  const { data: subscriptions, error } = await query;
  if (error) throw error;
  let sent = 0;
  for (const subscription of subscriptions || []) {
    try {
      await webpush.sendNotification(subscription.subscription, JSON.stringify({
        title: 'Testmelding van Samen Thuis',
        body: 'Gelukt! Dit apparaat ontvangt meldingen, ook wanneer de PWA gesloten is.',
        tag: `samen-thuis-test-${Date.now()}`, url: './#settings', kind: 'test', timestamp: Date.now()
      }), { TTL: 300, urgency: 'high' });
      sent += 1;
    } catch (pushError: any) {
      if ([404, 410].includes(Number(pushError?.statusCode))) {
        await admin.from('push_subscriptions').update({ active: false, updated_at: new Date().toISOString() }).eq('id', subscription.id);
      }
      throw pushError;
    }
  }
  return response(request, { ok: true, sent });
}

export async function handleRequest(request: Request) {
  if (request.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(request) });
  if (request.method !== 'POST') return response(request, { error: 'Alleen POST is toegestaan.' }, 405);
  try {
    const body = await request.json().catch(() => ({}));
    const config = await getConfig();
    if (body.action === 'send_due') return await sendDue(request, request.headers.get('x-cron-secret') || '', config);
    const { user, familyId } = await authenticatedFamily(request);
    if (body.action === 'config') return response(request, { publicKey: config.public_key });
    if (body.action === 'test') return await sendTest(request, config, user.id, familyId, body.endpoint);
    if (body.action === 'subscribe') {
      if (!validSubscription(body.subscription)) return response(request, { error: 'Ongeldige pushinschrijving.' }, 400);
      const timezone = typeof body.timezone === 'string' && body.timezone.length < 80 ? safeTimezone(body.timezone) : FALLBACK_TIMEZONE;
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

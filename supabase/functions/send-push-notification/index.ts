// ============================================================
// CHARLOTTE PARKING — Edge Function: send-push-notification
// Triggered da webhook Supabase su INSERT in prenotazioni
// Invia Web Push a tutti i dispositivi iscritti per quel garage
// ============================================================

import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import webPush from "npm:web-push@3.6.7";

const SUPABASE_URL        = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC_KEY    = Deno.env.get("VAPID_PUBLIC_KEY")!;
const VAPID_PRIVATE_KEY   = Deno.env.get("VAPID_PRIVATE_KEY")!;
const VAPID_SUBJECT       = Deno.env.get("VAPID_SUBJECT") || "mailto:info@charlotteparking.it";
const WEBHOOK_SECRET      = Deno.env.get("WEBHOOK_SECRET")!;

webPush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

serve(async (req: Request) => {
  // Sicurezza: verifica il secret del webhook
  const secret = req.headers.get("x-webhook-secret");
  if (secret !== WEBHOOK_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let body: any;
  try { body = await req.json(); }
  catch { return new Response("Invalid JSON", { status: 400 }); }

  // Accetta solo INSERT su prenotazioni
  if (body.type !== "INSERT" || !body.record) {
    return new Response("Ignored", { status: 200 });
  }

  const record = body.record;
  const garageId = record.garage_id;
  if (!garageId) return new Response("No garage_id", { status: 200 });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Recupera tutte le subscriptions push per questo garage
  const { data: subs, error } = await sb
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("garage_id", garageId);

  if (error || !subs || subs.length === 0) {
    return new Response("No subscribers", { status: 200 });
  }

  // Costruisce il payload della notifica
  const nomeCliente = record.nome_cliente || "Cliente";
  const targa = record.targa ? ` · ${record.targa}` : "";
  const dataI = record.data_ingresso
    ? new Date(record.data_ingresso).toLocaleDateString("it-IT", {
        day: "2-digit", month: "2-digit",
        hour: "2-digit", minute: "2-digit"
      })
    : "";

  const payload = JSON.stringify({
    title: `📅 Nuova prenotazione — ${nomeCliente}${targa}`,
    body: dataI ? `Arrivo previsto: ${dataI}` : "Apri l'app per i dettagli",
    url: "/charlotte-commercial/"
  });

  // Invia a tutti i dispositivi in parallelo
  const results = await Promise.allSettled(
    subs.map(sub =>
      webPush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
        payload
      )
    )
  );

  // Rimuove le subscriptions scadute (410 Gone = dispositivo disiscritto)
  const endpointsDaRimuovere: string[] = [];
  results.forEach((r, i) => {
    if (r.status === "rejected" && (r.reason as any)?.statusCode === 410) {
      endpointsDaRimuovere.push(subs[i].endpoint);
    }
  });
  if (endpointsDaRimuovere.length > 0) {
    await sb.from("push_subscriptions")
      .delete()
      .in("endpoint", endpointsDaRimuovere);
  }

  const ok = results.filter(r => r.status === "fulfilled").length;
  return new Response(`Sent: ${ok}/${subs.length}`, { status: 200 });
});

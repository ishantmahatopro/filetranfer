// Supabase Edge Function: receives a location reading from the public page,
// runs the VPN + Bangalore checks server-side (so the vpnapi key stays secret),
// and stores the reading only if the access rule allows it.
//
// Secrets required (set with `supabase secrets set`):
//   VPNAPI_KEY          - your vpnapi.io key
//   ALLOWED_ORIGIN      - (optional) your site origin for CORS, e.g.
//                         https://ishantmahatopro.github.io  ("*" if unset)
// Provided automatically by Supabase:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ---- Access rule config ----
const BANGALORE = { lat: 12.9716, lng: 77.5946, radiusKm: 45 };

// Return true to BLOCK. Default (per request): block only when the visitor is
// BOTH on a VPN AND outside Bangalore. Swap the commented line to change.
function shouldBlock(ctx: { isVPN: boolean; insideBangalore: boolean }): boolean {
  return ctx.isVPN && !ctx.insideBangalore;
  // Only allow inside Bangalore, block all VPNs:
  //   return ctx.isVPN || !ctx.insideBangalore;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

function clientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "";
}

async function vpnLookup(ip: string) {
  const key = Deno.env.get("VPNAPI_KEY");
  let isVPN = false, ipCity: string | null = null, ipCountry: string | null = null;
  if (key && ip) {
    try {
      const r = await fetch(`https://vpnapi.io/api/${ip}?key=${key}`);
      if (r.ok) {
        const d = await r.json();
        const s = d.security ?? {};
        isVPN = Boolean(s.vpn || s.proxy || s.tor);
        ipCity = d.location?.city ?? null;
        ipCountry = d.location?.country_code ?? null;
      }
    } catch (_) { /* treat unknown as not-VPN */ }
  }
  return { isVPN, ipCity, ipCountry };
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": Deno.env.get("ALLOWED_ORIGIN") ?? "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
  };
}

Deno.serve(async (req) => {
  const cors = corsHeaders();
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: cors });
  }

  let body: any;
  try { body = await req.json(); } catch { body = {}; }
  const lat = Number(body.lat), lng = Number(body.lng);
  if (!isFinite(lat) || !isFinite(lng)) {
    return new Response(JSON.stringify({ error: "bad coordinates" }),
      { status: 400, headers: { ...cors, "content-type": "application/json" } });
  }

  const ip = clientIp(req);
  const { isVPN, ipCity, ipCountry } = await vpnLookup(ip);
  const insideBangalore = haversineKm({ lat, lng }, BANGALORE) <= BANGALORE.radiusKm;

  if (shouldBlock({ isVPN, insideBangalore })) {
    return new Response(JSON.stringify({ allowed: false }),
      { headers: { ...cors, "content-type": "application/json" } });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const { error } = await supabase.from("locations").insert({
    lat, lng,
    accuracy: body.accuracy ?? null,
    address: body.address ?? null,
    map_url: body.mapUrl ?? `https://www.google.com/maps?q=${lat},${lng}`,
    is_vpn: isVPN,
    inside_bangalore: insideBangalore,
    ip_city: ipCity,
    ip_country: ipCountry,
    user_agent: body.userAgent ?? null,
  });

  if (error) {
    return new Response(JSON.stringify({ error: "store failed" }),
      { status: 500, headers: { ...cors, "content-type": "application/json" } });
  }
  return new Response(JSON.stringify({ allowed: true }),
    { headers: { ...cors, "content-type": "application/json" } });
});

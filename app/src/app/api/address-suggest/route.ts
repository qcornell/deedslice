import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/address-suggest?q=2960+Box&session=uuid
 *
 * Proxies Mapbox Search Box /suggest for address autocomplete.
 * We proxy server-side to keep the access token off the client.
 */
export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q");
  const sessionToken = req.nextUrl.searchParams.get("session") || crypto.randomUUID();

  if (!q || q.length < 3) {
    return NextResponse.json({ suggestions: [] });
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ suggestions: [], error: "Mapbox not configured" });
  }

  try {
    const params = new URLSearchParams({
      q,
      access_token: token,
      session_token: sessionToken,
      language: "en",
      country: "US",
      types: "address",
      limit: "5",
    });

    const res = await fetch(
      `https://api.mapbox.com/search/searchbox/v1/suggest?${params}`,
      { headers: { "Content-Type": "application/json" } }
    );

    if (!res.ok) {
      console.error("Mapbox suggest error:", res.status, await res.text());
      return NextResponse.json({ suggestions: [] });
    }

    const data = await res.json();

    const suggestions = (data.suggestions || []).map((s: any) => ({
      mapboxId: s.mapbox_id,
      name: s.name,
      fullAddress: s.full_address || s.place_formatted || s.name,
      address: s.address,
      placeFormatted: s.place_formatted,
    }));

    return NextResponse.json({ suggestions });
  } catch (err) {
    console.error("Address suggest error:", err);
    return NextResponse.json({ suggestions: [] });
  }
}

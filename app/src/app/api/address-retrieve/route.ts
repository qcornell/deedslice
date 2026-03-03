import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/address-retrieve?id=mapboxId&session=uuid
 *
 * Retrieves full structured address from Mapbox after user selects a suggestion.
 */
export async function GET(req: NextRequest) {
  const mapboxId = req.nextUrl.searchParams.get("id");
  const sessionToken = req.nextUrl.searchParams.get("session") || crypto.randomUUID();

  if (!mapboxId) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  const token = process.env.MAPBOX_ACCESS_TOKEN;
  if (!token) {
    return NextResponse.json({ error: "Mapbox not configured" }, { status: 500 });
  }

  try {
    const params = new URLSearchParams({
      access_token: token,
      session_token: sessionToken,
    });

    const res = await fetch(
      `https://api.mapbox.com/search/searchbox/v1/retrieve/${mapboxId}?${params}`
    );

    if (!res.ok) {
      console.error("Mapbox retrieve error:", res.status, await res.text());
      return NextResponse.json({ error: "Retrieve failed" }, { status: 500 });
    }

    const data = await res.json();
    const feature = data.features?.[0];

    if (!feature) {
      return NextResponse.json({ error: "No result" }, { status: 404 });
    }

    const props = feature.properties || {};
    const ctx = props.context || {};

    return NextResponse.json({
      fullAddress: props.full_address || props.name,
      streetAddress: props.name,
      city: ctx.place?.name || "",
      state: ctx.region?.name || "",
      stateCode: ctx.region?.region_code || "",
      zip: ctx.postcode?.name || "",
      country: ctx.country?.name || "United States",
      coordinates: feature.geometry?.coordinates, // [lng, lat]
    });
  } catch (err) {
    console.error("Address retrieve error:", err);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}

import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/property-value?address=2960+Boxelder+Dr,+Bryan,+TX+77807
 *
 * Returns an estimated property value from RentCast (Realty Mole) API.
 * Free tier: 50 calls/month — plenty for early stage.
 */
export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get("address");

  if (!address) {
    return NextResponse.json({ error: "Missing address" }, { status: 400 });
  }

  const apiKey = process.env.RENTCAST_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ estimate: null, message: "Valuation API not configured" });
  }

  try {
    // Try value estimate endpoint first
    const params = new URLSearchParams({ address });
    const res = await fetch(
      `https://api.rentcast.io/v1/avm/value?${params}`,
      { headers: { "X-Api-Key": apiKey, Accept: "application/json" } }
    );

    if (!res.ok) {
      // Fallback: try property records for tax assessment
      const propRes = await fetch(
        `https://api.rentcast.io/v1/properties?${params}`,
        { headers: { "X-Api-Key": apiKey, Accept: "application/json" } }
      );

      if (propRes.ok) {
        const propData = await propRes.json();
        const prop = Array.isArray(propData) ? propData[0] : propData;
        if (prop) {
          return NextResponse.json({
            estimate: prop.price || prop.assessedValue || null,
            source: "tax_assessment",
            propertyType: prop.propertyType || null,
            bedrooms: prop.bedrooms || null,
            bathrooms: prop.bathrooms || null,
            squareFootage: prop.squareFootage || null,
            yearBuilt: prop.yearBuilt || null,
            lotSize: prop.lotSize || null,
          });
        }
      }

      return NextResponse.json({ estimate: null, message: "No valuation data available" });
    }

    const data = await res.json();

    return NextResponse.json({
      estimate: data.price || data.priceRangeLow || null,
      priceRangeLow: data.priceRangeLow || null,
      priceRangeHigh: data.priceRangeHigh || null,
      source: "rentcast_avm",
      comparables: (data.comparables || []).slice(0, 3).map((c: any) => ({
        address: c.formattedAddress || c.address,
        price: c.price,
        squareFootage: c.squareFootage,
        distance: c.distance,
      })),
      propertyType: data.propertyType || null,
      squareFootage: data.squareFootage || null,
      bedrooms: data.bedrooms || null,
      bathrooms: data.bathrooms || null,
      yearBuilt: data.yearBuilt || null,
    });
  } catch (err) {
    console.error("Property value error:", err);
    return NextResponse.json({ estimate: null, error: "Valuation lookup failed" });
  }
}

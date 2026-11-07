import { NextResponse } from "next/server";
import { getDb } from "../../../lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const rooms = getDb()
    .prepare("SELECT id, number, category, price_per_night AS pricePerNight, status FROM rooms ORDER BY number")
    .all();
  return NextResponse.json(rooms);
}

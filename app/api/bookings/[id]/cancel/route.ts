import { getDb } from "../../../../../lib/db";
import { cancelBooking } from "../../../../../lib/booking";
import { toResponse } from "../../../../../lib/http";

export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  return toResponse(cancelBooking(getDb(), Number(id)));
}

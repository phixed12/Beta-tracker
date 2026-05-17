import { ok, requireAuth } from "@/lib/api-helpers";
import { groupApprovedEnrollments } from "@/lib/services/batch";

export async function POST() {
  await requireAuth();

  const batches = await groupApprovedEnrollments();
  return ok({ batched: batches.length });
}

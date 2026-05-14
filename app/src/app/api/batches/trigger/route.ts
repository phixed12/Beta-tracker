import { ok, requireAuth } from "@/lib/api-helpers";
import { groupApprovedEnrollments } from "@/lib/services/batch";

export async function POST() {
  const { error } = await requireAuth(["coordinator", "admin"]);
  if (error) return error;

  const batches = await groupApprovedEnrollments();
  return ok({ batched: batches.length });
}

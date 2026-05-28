export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { auth, clerkClient } from "@clerk/nextjs/server";
import { getPlanRecord } from "@monorepo-template/core/db/billing";
import { deleteAllUserData } from "@monorepo-template/core/db/account";
import { getStripe } from "@/app/api/billing/_stripe";

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // 1. Best-effort: cancel Stripe subscription if one exists.
    try {
      const plan = await getPlanRecord(userId);
      if (plan?.stripeSubId) {
        await getStripe().subscriptions.cancel(plan.stripeSubId);
      }
    } catch (stripeError) {
      console.error(
        "[account/delete] Stripe cancellation failed (continuing):",
        stripeError,
      );
    }

    // 2. Delete all DynamoDB rows for this user.
    const deletedCount = await deleteAllUserData(userId);
    console.log(
      `[account/delete] Deleted ${deletedCount} rows for user ${userId}`,
    );

    // 3. Delete the Clerk user (this signs out all sessions automatically).
    const clerk = await clerkClient();
    await clerk.users.deleteUser(userId);

    return Response.json({ ok: true });
  } catch (error) {
    console.error("[account/delete] Failed to delete account:", error);
    return Response.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to delete account. Please try again.",
      },
      { status: 500 },
    );
  }
}

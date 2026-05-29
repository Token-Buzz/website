import { TwitterApiError } from "@monorepo-template/core/lib/twitter";
import { TelegramApiError } from "@monorepo-template/core/lib/telegram";
import { markByokKeyInvalid } from "@monorepo-template/core/db/byok";

/**
 * Looks up the user's primary email via the Clerk REST API and sends them a
 * notification via Resend that their twitterapi.io key has been marked invalid.
 * Never throws — all errors are logged and swallowed.
 */
async function notifyKeyHolderInvalid(userId: string): Promise<void> {
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    console.error("notifyKeyHolderInvalid: CLERK_SECRET_KEY not set; skipping email");
    return;
  }

  // Fetch the user record from Clerk to get their primary email.
  let email: string | null = null;
  try {
    const clerkRes = await fetch(`https://api.clerk.com/v1/users/${userId}`, {
      headers: { Authorization: `Bearer ${clerkSecretKey}` },
    });
    if (!clerkRes.ok) {
      console.error(`notifyKeyHolderInvalid: Clerk returned ${clerkRes.status} for user ${userId}`);
      return;
    }
    const clerkUser = (await clerkRes.json()) as {
      primary_email_address_id?: string;
      email_addresses?: Array<{ id: string; email_address: string }>;
    };
    const emails = clerkUser.email_addresses ?? [];
    const primary = emails.find((e) => e.id === clerkUser.primary_email_address_id);
    email = primary?.email_address ?? emails[0]?.email_address ?? null;
  } catch (err) {
    console.error("notifyKeyHolderInvalid: Clerk fetch failed", err);
    return;
  }

  if (!email) {
    console.error(`notifyKeyHolderInvalid: no email found for user ${userId}`);
    return;
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromAddress = process.env.CONTACT_FROM_ADDRESS;
  const webDomain = process.env.WEB_DOMAIN;

  if (!resendApiKey || !fromAddress) {
    console.error("notifyKeyHolderInvalid: RESEND_API_KEY or CONTACT_FROM_ADDRESS not set; skipping email");
    return;
  }

  const apiKeysUrl = `https://app.${webDomain ?? "tokenbuzz.app"}/account/api-keys`;
  const html = `
<p>Hi,</p>
<p>Your twitterapi.io API key connected to TokenBuzz has been rejected (HTTP 401/403) and has been marked <strong>invalid</strong>. Background polling of your watchlist has been <strong>paused</strong> until you re-enter a valid key.</p>
<p>To restore polling, please visit your API Keys page and enter a new key:<br>
<a href="${apiKeysUrl}">${apiKeysUrl}</a></p>
<p>If you believe this is an error, please check that your twitterapi.io account is active and that the key has not been rotated or revoked.</p>
<p>— The TokenBuzz team</p>
`.trim();

  try {
    const resendRes = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [email],
        subject: "Your TokenBuzz API key needs attention",
        html,
      }),
    });
    if (!resendRes.ok) {
      const body = await resendRes.text().catch(() => "(unreadable)");
      console.error(`notifyKeyHolderInvalid: Resend returned ${resendRes.status}: ${body}`);
    }
  } catch (err) {
    console.error("notifyKeyHolderInvalid: Resend fetch failed", err);
  }
}

/**
 * If `err` is a 401/403 from twitterapi.io, mark the holder's key invalid and
 * email them, then return true (caller should stop using that holder this cycle).
 * Returns false for any other error (caller logs and continues). Never throws.
 */
export async function handleKeyError(
  err: unknown,
  userId: string,
  provider: string,
): Promise<boolean> {
  if (
    (err instanceof TwitterApiError || err instanceof TelegramApiError) &&
    (err.status === 401 || err.status === 403)
  ) {
    try {
      await markByokKeyInvalid(userId, provider);
    } catch (e) {
      console.error("markByokKeyInvalid failed", e);
    }
    try {
      await notifyKeyHolderInvalid(userId);
    } catch (e) {
      console.error("notifyKeyHolderInvalid failed", e);
    }
    return true;
  }
  return false;
}

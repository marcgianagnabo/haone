import { createEmail, sendEmail } from "$api/services/gmail-service";
import {
  RegistrationApprovedTemplate,
  RegistrationOnHoldTemplate
} from "$lib/templates/registration";
import { auth } from "$state/auth.svelte";
import { brandingState } from "$state/branding.svelte";

function requireSenderContext() {
  const accessToken = auth.accessToken;
  if (!accessToken) {
    throw new Error("Email not sent: Gmail authorization is missing. Please sign in again.");
  }
  return { accessToken, branding: brandingState.profile };
}

/**
 * Sends the account-approved notification directly via the acting admin's
 * Gmail (not through the email dispatcher). Call after applySync succeeds —
 * a send failure never rolls back the approved registration.
 */
export async function sendRegistrationApprovedEmail(to: string, name: string): Promise<void> {
  const { accessToken, branding } = requireSenderContext();
  const data = { accountName: name || "Resident" };
  const raw = createEmail(
    to,
    RegistrationApprovedTemplate.subject(data, branding),
    RegistrationApprovedTemplate.generateHtml(data, branding),
    branding.replyTo
  );
  await sendEmail(accessToken, raw);
}

/**
 * Sends the account on-hold notification directly via the acting admin's
 * Gmail (not through the email dispatcher). Call after declineRegistration
 * succeeds — a send failure never rolls back the decline.
 */
export async function sendRegistrationOnHoldEmail(
  to: string,
  name: string,
  reason: string
): Promise<void> {
  const { accessToken, branding } = requireSenderContext();
  const data = { accountName: name || "Resident", reason };
  const raw = createEmail(
    to,
    RegistrationOnHoldTemplate.subject(data, branding),
    RegistrationOnHoldTemplate.generateHtml(data, branding),
    branding.replyTo
  );
  await sendEmail(accessToken, raw);
}

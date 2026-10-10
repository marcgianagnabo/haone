import type { BrandingProfile, EmailTemplate } from "$lib/types";
import { wrapEmailHtml } from "./base";

export interface RegistrationApprovedData {
  accountName: string;
}

export interface RegistrationOnHoldData {
  accountName: string;
  reason: string;
}

/**
 * Generates HTML for a registration-approval notification email.
 * Sent automatically (via the acting admin's Gmail) when a sync
 * registration is approved — not through the email dispatcher.
 */
export function generateRegistrationApprovedHtml(
  data: RegistrationApprovedData,
  branding: BrandingProfile
) {
  const content = `
    <p style="font-size: 16px; margin-bottom: 5px; font-weight: normal; display: block; color: #000;">You are all set! <strong style="font-weight: bold;">${data.accountName}</strong></p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Please be advised that your HAOne Account has been successfully approved. Please refresh your browser and check the app. If you have any clarifications or concerns you can message us at <a href="mailto:${branding.replyTo}" style="color: #0047AB; text-decoration: underline;">${branding.replyTo}</a> or message any available officer.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Thank you.<br>-NFRH Association
    </p>
  `;

  return wrapEmailHtml(content, branding.emailHeaderUrl, branding.replyTo);
}

export const RegistrationApprovedTemplate: EmailTemplate<RegistrationApprovedData> = {
  subject: (data, branding) => {
    return `[${branding.shortName}] Your HAOne Account Has Been Approved`;
  },
  generateHtml: generateRegistrationApprovedHtml
};

/**
 * Generates HTML for a registration on-hold notification email.
 * Sent automatically (via the acting admin's Gmail) when a sync
 * registration is declined — not through the email dispatcher.
 */
export function generateRegistrationOnHoldHtml(
  data: RegistrationOnHoldData,
  branding: BrandingProfile
) {
  const content = `
    <p style="font-size: 16px; margin-bottom: 5px; font-weight: normal; display: block; color: #000;">Hi, <strong style="font-weight: bold;">${data.accountName}</strong></p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Please be advised that your HAOne Account application has been put on hold. You can send us an email at <a href="mailto:${branding.replyTo}" style="color: #0047AB; text-decoration: underline;">${branding.replyTo}</a> or contact an officer if you have any questions.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Reason: <strong style="font-weight: bold;">${data.reason}</strong>
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      After your account has been fully resolved, you can try to submit your application once again.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      - NFRH Association
    </p>
  `;

  return wrapEmailHtml(content, branding.emailHeaderUrl, branding.replyTo);
}

export const RegistrationOnHoldTemplate: EmailTemplate<RegistrationOnHoldData> = {
  subject: (data, branding) => {
    return `[${branding.shortName}] ACTION REQUIRED: Your HAOne Account needs Further Verification`;
  },
  generateHtml: generateRegistrationOnHoldHtml
};

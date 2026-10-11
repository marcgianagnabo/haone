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
    <p style="font-size: 16px; margin-bottom: 5px; font-weight: bold; display: block; color: #000;">HAOne Account Approved</p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Hello, ${data.accountName}.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Your HAOne account has been successfully approved. You may now access HAOne using your registered account.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      To get started, refresh your browser and open the HAOne application.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      If you have any questions or encounter any issues, contact us at <a href="mailto:${branding.replyTo}" style="color: #0047AB; text-decoration: underline;">${branding.replyTo}</a> or reach out to any available NFRH officer.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Thank you.<br><strong style="font-weight: bold;">${branding.issuerName}</strong>
    </p>
  `;

  return wrapEmailHtml(content, branding.emailHeaderUrl, branding.replyTo);
}

export const RegistrationApprovedTemplate: EmailTemplate<RegistrationApprovedData> = {
  subject: (data, branding) => {
    return `[${branding.shortName}] HAOne Account Approval Confirmation`;
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
    <p style="font-size: 16px; margin-bottom: 5px; font-weight: bold; display: block; color: #000;">HAOne Account Application: Further Verification Required</p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Hello, ${data.accountName}.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Your HAOne account application has been placed on hold pending further verification.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Reason for Hold: <strong style="font-weight: bold;">${data.reason}</strong>
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Please review the reason stated above and contact us at <a href="mailto:${branding.replyTo}" style="color: #0047AB; text-decoration: underline; font-weight: bold;">${branding.replyTo}</a> or reach out to any available NFRH officer if you need clarification or assistance.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Once the issue has been addressed, you may resubmit your HAOne account application for review.
    </p>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block;">
      Thank you for your cooperation.<br><strong style="font-weight: bold;">${branding.issuerName}</strong>
    </p>
  `;

  return wrapEmailHtml(content, branding.emailHeaderUrl, branding.replyTo);
}

export const RegistrationOnHoldTemplate: EmailTemplate<RegistrationOnHoldData> = {
  subject: (data, branding) => {
    return `[${branding.shortName}] Action Required: Further Verification of Your HAOne Account`;
  },
  generateHtml: generateRegistrationOnHoldHtml
};

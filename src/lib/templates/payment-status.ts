import type { BrandingProfile, EmailTemplate } from "$lib/types";
import { formatAccounting, formatAmount } from "$utils/formatters";
import { wrapEmailHtml } from "./base";

export interface PaymentStatusData {
  accountName: string;
  room: string;
  bed: string;
  waterBase: number;
  waterPaid: number;
  waterWaived: number;
  waterBal: number;
  assocBase: number;
  assocPaid: number;
  assocWaived: number;
  assocBal: number;
  maintenanceBase?: number;
  maintenancePaid?: number;
  maintenanceWaived?: number;
  maintenanceBal?: number;
  totalBase: number;
  paid: number;
  waived: number;
  bal: number;
  isFullyPaid: boolean;
  reminders: string;
  warnReservationCancellation?: boolean;
  warnClearance?: boolean;
  hideBedNotice?: boolean;
}

/**
 * Generates HTML for a Payment Status Update email.
 */
export function generatePaymentStatusHtml(data: PaymentStatusData, branding: BrandingProfile) {
  const dateStr = new Date()
    .toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    .toUpperCase();

  const fullyPaidSection = `
    <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; margin-top: 25px;">
      <tr>
        <td style="padding: 15px; border: 1px solid #000; font-size: 13px; vertical-align: middle; ${data.isFullyPaid ? "background-color: #f8fafc;" : ""}">
          <p style="font-size: 14px; font-weight: bold; margin-bottom: 5px; color: #000; display: block;">Is Certificate of Full Payment Available?</p>
          <p style="font-size: 11px; color: #000; line-height: 1.4; margin: 0; ${data.isFullyPaid ? "margin-bottom: 10px;" : ""}">
            Clearance from the Residence Hall Association will be issued either upon request or after the last payment that fully settles the account.
          </p>
          ${
            data.isFullyPaid
              ? `
          <p style="font-size: 11px; color: #000; line-height: 1.4; margin: 0; font-style: italic;">
            For your security, the link is password-protected. You may open it by entering your student number (e.g., 2001-01234).
          </p>
          `
              : ""
          }
        </td>
        <td style="padding: 15px; text-align: center; width: 60px; border: 1px solid #000; font-size: 13px; font-weight: bold; vertical-align: middle;">
          ${data.isFullyPaid ? "YES" : "NO"}
        </td>
      </tr>
    </table>
  `;

  const negativeNotice =
    data.bal < 0
      ? `
    <p style="color: #dc2626; font-weight: bold; font-size: 14px; text-transform: uppercase; margin-top: 25px; display: block;">
      IMPORTANT: If you see a NEGATIVE OUTSTANDING AMOUNT above, you may be eligible for a refund. Please inquire at Room B105.
    </p>
  `
      : "";

  const accountSpecificContent = data.reminders
    ? `
    <div style="margin-bottom: 25px; color: #000; font-size: 14px;">
      ${data.reminders}
    </div>
  `
    : "";

  const replacements = {
    "{assocBase}": formatAmount(data.assocBase),
    "{assocHalf}": formatAmount(data.assocBase / 2),
    "{waterMonthly}": formatAmount(data.waterBase / 4),
    "{waterHalf}": formatAmount(data.waterBase / 8)
  };

  const sectionRules =
    !data.isFullyPaid && branding.sectionRules
      ? Object.entries(replacements).reduce(
          (acc, [key, val]) => acc.replace(new RegExp(key, "g"), val),
          branding.sectionRules
        )
      : "";

  const bedNotice =
    !data.bed && !data.hideBedNotice
      ? `
    <div style="margin-top: 25px; margin-bottom: 25px; padding: 20px; border: 2px solid #dc2626; background-color: #fef2f2; border-radius: 8px; text-align: center;">
      <p style="margin: 0; font-size: 16px; font-weight: bold; color: #991b1b; text-transform: uppercase;">Action Required</p>
      <p style="margin: 10px 0; font-size: 14px; color: #b91c1c; line-height: 1.5;">
        Please complete the Semestral Association Member Registration Form immediately.
      </p>
      <div style="margin-top: 15px;">
        <a href="${branding.regFormUrl || "#"}" style="display: inline-block; padding: 12px 25px; background-color: #dc2626; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 14px;">COMPLETE FORM</a>
      </div>
    </div>`
      : "";

  const reservationWarning =
    data.warnReservationCancellation && data.paid < data.totalBase / 2
      ? `
    <div style="margin-top: 25px; margin-bottom: 25px; padding: 20px; border: 2px solid #dc2626; background-color: #fef2f2; border-radius: 8px;">
      <p style="margin: 0; font-size: 16px; font-weight: bold; color: #991b1b; text-transform: uppercase;">⚠️ Priority Reservation Warning</p>
      <p style="margin: 10px 0 0 0; font-size: 14px; color: #b91c1c; line-height: 1.5;">
        Our records indicate that your balance is not yet half-settled (at least 50% of the total fees). Please be advised that non-settlement or failure to submit a promissory note may lead to the <strong>cancellation of your priority reservation application</strong>.
      </p>
    </div>`
      : "";

  const clearanceWarning =
    data.warnClearance && !data.isFullyPaid
      ? `
    <div style="margin-top: 25px; margin-bottom: 25px; padding: 20px; border: 2px solid #dc2626; background-color: #fef2f2; border-radius: 8px;">
      <p style="margin: 0; font-size: 16px; font-weight: bold; color: #991b1b; text-transform: uppercase;">⚠️ CLEARANCE WARNING</p>
      <p style="margin: 10px 0 0 0; font-size: 14px; color: #b91c1c; line-height: 1.5; font-style: italic;">
        25. The resident shall pay a semestral association fee to the Residence Hall Association and other fees (e.g., Water fees, Gas fees, etc.) determined and agreed upon by the Association and the hall residents. Non-payment or insufficient payment to the Association will incur an accountability and may be cause for holding the resident’s next dorm application and University clearance until settled.
      </p>
      <p style="margin: 10px 0 0 0; font-size: 11px; color: #7f1d1d; font-weight: bold;">SECTION 25 (NORMS OF CONDUCT AND RESPONSIBILITIES) OF THE RESIDENCE HALL AGREEMENT</p>
    </div>`
      : "";

  const content = `
    <p style="font-size: 16px; margin-bottom: 5px; font-weight: normal; display: block; color: #000;">Hi, <strong style="font-weight: bold;">${data.accountName}</strong> (Room ${data.room})</p>
    
    ${bedNotice}
    ${reservationWarning}
    ${clearanceWarning}

    <p style="font-size: 14px; color: #000; margin-bottom: 25px; line-height: 1.5; display: block;">Please review your payment status for the current semester below:</p>

    <h3 style="background-color: #000; color: #ffffff; text-align: center; padding: 10px; font-size: 14px; letter-spacing: 1px; margin: 0; display: block; font-weight: bold;">PAYMENT STATUS AS OF ${dateStr}</h3>

    <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; display: table;">
      <!-- WATER FEES SECTION -->
      <tr>
        <td rowspan="4" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: top; width: 30%;">
          <p style="font-weight: bold; margin-bottom: 2px;">Water Fees</p>
          <p style="font-size: 11px; color: #000; line-height: 1.4; margin: 0; font-style: italic;">for the entire semester</p>
        </td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Billed Amount</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.waterBase)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Total Amount Paid</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.waterPaid)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Waived</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.waterWaived)}</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; font-weight: bold;">Amount Due</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0; font-weight: bold;">₱</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px; font-weight: bold;">${formatAmount(data.waterBal)}</td>
      </tr>

      <!-- ASSOCIATION FEE SECTION -->
      <tr style="border-top: 2px solid #000;">
        <td rowspan="4" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: top; width: 30%;">
          <p style="font-weight: bold; margin-bottom: 2px;">Association Fee</p>
          <p style="font-size: 11px; color: #000; line-height: 1.4; margin: 0; font-style: italic;">for the entire semester</p>
        </td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Billed Amount</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.assocBase)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Total Amount Paid</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.assocPaid)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Waived</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.assocWaived)}</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; font-weight: bold;">Amount Due</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0; font-weight: bold;">₱</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px; font-weight: bold;">${formatAmount(data.assocBal)}</td>
      </tr>

      <!-- MAINTENANCE & GAS FEE SECTION -->
      <tr style="border-top: 2px solid #000;">
        <td rowspan="4" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: top; width: 30%;">
          <p style="font-weight: bold; margin-bottom: 2px;">Maintenance & Gas Fee</p>
          <p style="font-size: 11px; color: #000; line-height: 1.4; margin: 0; font-style: italic;">for the entire semester</p>
        </td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Billed Amount</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.maintenanceBase || 0)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Total Amount Paid</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.maintenancePaid || 0)}</td>
      </tr>
      <tr>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Waived</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.maintenanceWaived || 0)}</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; font-weight: bold;">Amount Due</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0; font-weight: bold;">₱</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px; font-weight: bold;">${formatAmount(data.maintenanceBal || 0)}</td>
      </tr>

      <!-- SUMMARY SECTION -->
      <tr style="background-color: #000; color: #ffffff;">
        <td colspan="4" style="text-align: center; padding: 10px; font-size: 13px; letter-spacing: 1px; font-weight: bold;">SUMMARY</td>
      </tr>
      <tr>
        <td colspan="2" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">
          <p style="font-weight: bold; margin-bottom: 2px;">Billed Amount</p>
          <p style="font-size: 10px; font-style: italic; color: #000; margin: 0;">for the entire semester</p>
        </td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px; font-weight: bold;">${formatAccounting(data.totalBase)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Total Amount Paid</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.paid)}</td>
      </tr>
      <tr>
        <td colspan="2" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">Less: Waived</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.waived)}</td>
      </tr>
      <tr style="background-color: #f8fafc;">
        <td colspan="2" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; font-weight: bold;">Outstanding Amount</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0; font-weight: bold;">₱</td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px; font-weight: bold; color: ${data.bal < 0 ? "#dc2626" : "black"};">${formatAmount(data.bal)}</td>
      </tr>
    </table>

    ${fullyPaidSection}

    ${negativeNotice}

    <p style="font-size: 14px; font-weight: bold; margin-top: 12px; margin-bottom: 12px; color: #000; display: block;">Reminders:</p>
    
    ${accountSpecificContent}

    ${sectionRules}

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block; font-weight: bold; margin-top: 20px; text-decoration: underline;">Payment Options and Considerations:</p>
    <ul style="margin: 15px 0 15px 0; padding: 0 0 0 35px; display: block; list-style-position: outside;">
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;">Refer to the bulletin board or <a href="${branding.paymentInstructionsUrl || "#"}" style="color: #0047AB; text-decoration: underline;">this document</a> for payment instructions.</li>
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;">Residents have the option to pay the full amount upfront.</li>
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;">Residents experiencing financial difficulties can defer payment by notifying the house council officers.</li>
    </ul>

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block; margin-top: 35px;">
      For inquiries and comments, please feel free to reach out to the officers in person or contact us at <a href="mailto:${branding.replyTo}" style="color: #0047AB; text-decoration: underline;">${branding.replyTo}</a>.
    </p>
  `;

  return wrapEmailHtml(content, branding.emailHeaderUrl, branding.replyTo);
}

export const PaymentStatusTemplate: EmailTemplate<PaymentStatusData> = {
  subject: (_data, branding) => {
    const dateStr = new Date().toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric"
    });
    return `[${branding.shortName}] Payment Status as of ${dateStr}`;
  },
  generateHtml: generatePaymentStatusHtml
};

/**
 * Generates HTML for a Statement of Account email.
 */
export function generateStatementOfAccountHtml(data: PaymentStatusData, branding: BrandingProfile) {
  const accountSpecificContent = data.reminders
    ? `
    <div style="margin-bottom: 25px; color: #000; font-size: 14px;">
      ${data.reminders}
    </div>
  `
    : "";

  const replacements = {
    "{assocBase}": formatAmount(data.assocBase),
    "{assocHalf}": formatAmount(data.assocBase / 2),
    "{waterMonthly}": formatAmount(data.waterBase / 4),
    "{waterHalf}": formatAmount(data.waterBase / 8)
  };

  const sectionRules =
    !data.isFullyPaid && branding.sectionRules
      ? Object.entries(replacements).reduce(
          (acc, [key, val]) => acc.replace(new RegExp(key, "g"), val),
          branding.sectionRules
        )
      : "";

  const content = `
    <p style="font-size: 16px; margin-bottom: 5px; font-weight: normal; display: block; color: #000;">Hi, <strong style="font-weight: bold;">${data.accountName}</strong> (Room ${data.room})</p>

    <p style="font-size: 14px; color: #000; margin-bottom: 25px; line-height: 1.5; display: block;"> Please review the breakdown of your water, association, and maintenance fees for the current semester below:</p>

    ${sectionRules}

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block; font-weight: bold; margin-top: 20px; text-decoration: underline;">Payment Options and Considerations:</p>
    <ul style="margin: 15px 0 15px 0; padding: 0 0 0 35px; display: block; list-style-position: outside;">
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;">Refer to the bulletin board or <a href="${branding.paymentInstructionsUrl || "#"}" style="color: #0047AB; text-decoration: underline;">this document</a> for payment instructions.</li>
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;">Residents have the option to pay the full amount upfront.</li>
      <li style="margin-bottom: 10px; list-style-type: disc; line-height: 1.4; font-size: 14px; color: #000;">Residents experiencing financial difficulties can defer payment by notifying the house council officers.</li>
    </ul>

    <table style="width: 100%; border-collapse: collapse; border: 1px solid #000; display: table;">
      <tr style="background-color: #000; color: #ffffff;">
        <td colspan="1" style="text-align: center; padding: 10px; font-size: 13px; letter-spacing: 1px; font-weight: bold;">DESCRIPTION</td>
        <td colspan="2" style="text-align: center; padding: 10px; font-size: 13px; letter-spacing: 1px; font-weight: bold;">BILLED AMOUNT FOR THE ENTIRE SEMESTER</td>
      </tr>
      <!-- WATER FEES SECTION -->
      <tr>
        <td rowspan="1" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: top; width: 30%;">
          <p style="font-weight: bold; margin-bottom: 2px;">Water Fees</p>
        </td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.waterBase)}</td>
      </tr>
      <!-- ASSOCIATION FEE SECTION -->
      <tr>
        <td rowspan="1" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: top; width: 30%;">
          <p style="font-weight: bold; margin-bottom: 2px;">Association Fee</p>
        </td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.assocBase)}</td>
      </tr>
      <!-- MAINTENANCE & GAS FEE SECTION -->
      <tr>
        <td rowspan="1" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: top; width: 30%;">
          <p style="font-weight: bold; margin-bottom: 2px;">Maintenance & Gas Fee</p>
        </td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px;">${formatAccounting(data.maintenanceBase || 0)}</td>
      </tr>
      <!-- SUMMARY SECTION -->
      <tr>
        <td colspan="1" style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle;">
          <p style="font-weight: bold; margin-bottom: 2px;">Billed Amount</p>
        </td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; border-right: none; width: 25px; padding-right: 0;"></td>
        <td style="padding: 10px 12px; border: 1px solid #000; font-size: 13px; vertical-align: middle; text-align: right; border-left: none; width: 100px; font-weight: bold;">${formatAccounting(data.totalBase)}</td>
      </tr>
    </table>

    <p style="font-size: 14px; font-weight: bold; margin-top: 12px; margin-bottom: 12px; color: #000; display: block;">Reminders:</p>
    
    ${accountSpecificContent}

    <p style="font-size: 14px; color: #000; margin-bottom: 20px; line-height: 1.5; display: block; margin-top: 35px;">
      For inquiries and comments, please feel free to reach out to the officers in person or contact us at <a href="mailto:${branding.replyTo}" style="color: #0047AB; text-decoration: underline;">${branding.replyTo}</a>.
    </p>
  `;

  return wrapEmailHtml(content, branding.emailHeaderUrl, branding.replyTo);
}

export const StatementOfAccountTemplate: EmailTemplate<PaymentStatusData> = {
  subject: (_data, branding) => {
    return `[${branding.shortName}] Statement of Account for Semestral Fees`;
  },
  generateHtml: generateStatementOfAccountHtml
};

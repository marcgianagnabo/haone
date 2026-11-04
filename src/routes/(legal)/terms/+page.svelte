<script lang="ts">
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";

  onMount(() => {
    pageState.title = "Terms of Service";
  });
</script>

<div class="container mx-auto max-w-4xl px-6 py-10">
  <div class="mb-8 flex items-center gap-3">
    <img src="/ha1.svg" alt="HAOne" class="h-10 w-10 dark:hidden" />
    <img src="/ha1_bw.svg" alt="HAOne" class="hidden h-10 w-10 dark:block" />
    <span class="text-xl font-bold tracking-tight">HAOne</span>
  </div>

  <ContentHeader title="Terms of Service" subtitle="Last Updated: April 2026" href="/" />

  <div class="mt-12 space-y-12 text-foreground">
    <div class="space-y-4">
      <p class="leading-relaxed">
        These Terms of Service ("Terms") govern your access to and use of HAOne (the "Platform"), a
        residential financial management portal operated by HAOne Development Team ("we," "us,"
        "our," or the "Organization").
      </p>
      <p class="leading-relaxed">
        By accessing or using the Platform, you agree to be bound by these Terms. If you do not
        agree to these Terms, you may not use the Platform. Continued use of the Platform
        constitutes your acceptance of any changes to these Terms.
      </p>
    </div>

    <section id="introduction" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">1. Introduction & Acceptance</h2>
      <p class="leading-relaxed">
        These Terms govern your access to and use of HAOne (the "Platform"), a residential financial
        management portal operated by HAOne Development Team ("we," "us," "our," or the
        "Organization").
      </p>
      <p class="leading-relaxed">
        By accessing or using the Platform, you agree to be bound by these Terms. If you do not
        agree to these Terms, you may not use the Platform. Continued use of the Platform
        constitutes your acceptance of any changes to these Terms.
      </p>
    </section>

    <section id="eligibility" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">2. Eligibility & Access</h2>
      <h3 class="text-lg font-semibold">2.1 User Eligibility</h3>
      <p class="leading-relaxed">Access to the Platform is restricted to:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>UPLB student residents</strong> residing in Office of Student Housing
          (OSH)-managed residence halls with an active
          <code class="rounded bg-muted px-1">up.edu.ph</code> email account
        </li>
        <li>
          Select <strong>UPLB Housing Office beneficiaries</strong> residing in residence halls shared
          with OSH
        </li>
        <li>
          Transient residents or guests with temporary access granted by the residence hall
          association
        </li>
        <li>
          <strong>House Council officers</strong> of the residence hall association with explicit authorization
        </li>
        <li>
          <strong>Alumni residents</strong>
        </li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">2.2 Account Responsibility</h3>
      <p class="leading-relaxed">You are responsible for:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Maintaining the confidentiality of your Google account credentials</li>
        <li>All activities that occur under your account</li>
        <li>Notifying us immediately of any unauthorized access or security breach</li>
      </ul>
      <p class="pt-2 leading-relaxed">
        The Organization reserves the right to suspend or terminate access for accounts with
        suspicious activity or policy violations.
      </p>
    </section>

    <section id="permitted-use" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">3. Permitted Use</h2>
      <p class="leading-relaxed">You agree to use the Platform solely for:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Viewing your personal financial account status and transaction history</li>
        <li>Submitting payment information and documentation</li>
        <li>Receiving institutional communications regarding your account</li>
        <li>Administrative management and auditing (for authorized staff)</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">3.1 Prohibited Activities</h3>
      <p class="leading-relaxed">You agree NOT to:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Access accounts or data not belonging to you</li>
        <li>Attempt to bypass security measures or authentication systems</li>
        <li>Reverse-engineer, decompile, or extract code from the Platform</li>
        <li>Scrape, bulk download, or automate data collection</li>
        <li>Share your credentials or grant unauthorized third-party access</li>
        <li>Use the Platform for any commercial, competitive, or external purpose</li>
        <li>Submit false, fraudulent, or misleading information</li>
        <li>Interfere with the Platform's technical infrastructure or operations</li>
        <li>Transmit viruses, malware, or harmful code</li>
      </ul>
    </section>

    <section id="intellectual-property" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        4. Intellectual Property Rights
      </h2>
      <h3 class="text-lg font-semibold">4.1 Platform Ownership</h3>
      <p class="leading-relaxed">
        All rights, title, and interest in HAOne are owned by HAOne Development Team. HAOne is open
        source software licensed under the <a
          href="https://www.mozilla.org/en-US/MPL/2.0/"
          class="underline underline-offset-4 transition-colors hover:text-primary"
          >Mozilla Public License 2.0 (MPL 2.0)</a
        >. The source code is publicly available under this license. You retain no ownership rights
        to any proprietary content or configurations of the Platform.
      </p>

      <h3 class="mt-6 text-lg font-semibold">4.2 Your Content</h3>
      <p class="leading-relaxed">
        You retain ownership of any content you voluntarily submit (e.g., payment notes, personal
        information). By submitting such content, you grant the Organization a non-exclusive,
        perpetual license to use, store, process, and display that content for operational and
        administrative purposes.
      </p>
    </section>

    <section id="financial-transactions" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        5. Financial Transactions & Payment Processing
      </h2>
      <h3 class="text-lg font-semibold">5.1 Transaction Accuracy</h3>
      <p class="leading-relaxed">
        The Organization makes reasonable efforts to process transactions accurately. However:
      </p>
      <ul class="ml-6 list-disc space-y-2">
        <li>You are responsible for verifying payment amounts before submission</li>
        <li>
          The Organization is not liable for errors resulting from incomplete or incorrect
          information provided by you
        </li>
        <li>All transactions are processed according to the Academic Period schedules</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">5.2 Payment Methods & Records</h3>
      <p class="leading-relaxed">
        The Platform records transaction data for the following payment methods:
      </p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Cash payments</li>
        <li>GCash transfers</li>
        <li>Maya transfers</li>
        <li>Gotyme Bank transfers</li>
        <li>MariBank transfers</li>
      </ul>
      <p class="pt-2 leading-relaxed">
        The Platform does not directly process or interface with payment gateways. It stores payment
        information including reference numbers, payment dates, and transaction details submitted by
        users or administrators. Actual payment processing and validation occur outside the
        Platform.
      </p>

      <h3 class="mt-6 text-lg font-semibold">5.3 Refunds & Adjustments</h3>
      <p class="leading-relaxed">
        Requests for refunds or account adjustments must be submitted through official channels. The
        Organization reserves the right to:
      </p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Review all refund requests for eligibility</li>
        <li>Require supporting documentation</li>
        <li>Process adjustments in accordance with institutional policy</li>
      </ul>
    </section>

    <section id="data-privacy" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">6. Data & Privacy</h2>
      <p class="leading-relaxed">
        Your use of the Platform is governed by our <strong>Privacy Policy</strong> (linked below). By
        using the Platform, you acknowledge that:
      </p>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          Personal and financial data will be processed in accordance with applicable data
          protection regulations
        </li>
        <li>Data is stored securely using industry-standard encryption</li>
        <li>Access is restricted to authorized personnel only</li>
        <li>Data retention follows institutional and legal requirements</li>
      </ul>
    </section>

    <section id="warranty-liability" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        7. Use of Platform: No Warranty, No Liability
      </h2>
      <h3 class="text-lg font-semibold">7.1 Platform Provided As-Is</h3>
      <p class="leading-relaxed">
        The Platform is provided on an "AS-IS" basis without warranties of any kind, either express
        or implied. The Organization makes no representations regarding accuracy, completeness,
        availability, or fitness for a particular purpose.
      </p>

      <h3 class="mt-6 text-lg font-semibold">7.2 Disclaimer of Warranties</h3>
      <p class="leading-relaxed">
        The Organization disclaims all warranties, including implied warranties of merchantability,
        fitness for a particular purpose, and non-infringement. Your use of the Platform is at your
        sole risk.
      </p>

      <h3 class="mt-6 text-lg font-semibold">7.3 No Liability</h3>
      <p class="leading-relaxed">
        The Organization shall not be liable for any damages arising from your use of the Platform,
        including but not limited to:
      </p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Errors, omissions, or inaccuracies in transaction processing</li>
        <li>Interruptions, delays, or unavailability of the Platform</li>
        <li>Loss of data or financial information</li>
        <li>Unauthorized access to your account</li>
        <li>Any indirect, incidental, consequential, or special damages</li>
      </ul>
      <p class="pt-2 leading-relaxed">
        You acknowledge that the Platform is operated by the HAOne Development Team as open source
        software (MPL 2.0) and use it at your own risk.
      </p>

      <h3 class="mt-6 text-lg font-semibold">7.4 Indemnification</h3>
      <p class="leading-relaxed">
        You agree to indemnify, defend, and hold harmless the HAOne Development Team, its members,
        and affiliates from and against any claims, liabilities, damages, losses, and expenses
        (including reasonable legal fees) arising out of or in any way connected with your access to
        or use of the Platform, or your violation of these Terms.
      </p>
    </section>

    <section id="termination" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        8. Termination & Account Suspension
      </h2>
      <h3 class="text-lg font-semibold">8.1 Termination by Organization</h3>
      <p class="leading-relaxed">The Organization may suspend or terminate your access:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Upon your graduation, severance, or move-out from OSH-managed residence halls</li>
        <li>For violation of these Terms or applicable laws</li>
        <li>For non-payment of fees or outstanding balances</li>
        <li>At any time for operational or security reasons</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">8.2 Effect of Termination</h3>
      <p class="leading-relaxed">Upon termination:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Your access to the Platform ceases immediately</li>
        <li>You remain liable for any outstanding balances</li>
        <li>The Organization retains records for auditing and legal compliance</li>
      </ul>
    </section>

    <section id="modifications" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        9. Modifications to Terms & Platform
      </h2>
      <p class="leading-relaxed">The Organization reserves the right to:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Modify these Terms at any time with notice to users</li>
        <li>Discontinue features, services, or the Platform itself</li>
        <li>Make technical changes that may affect functionality</li>
      </ul>
      <p class="pt-2 leading-relaxed">
        Continued use of the Platform following notice of modifications constitutes acceptance of
        the updated Terms.
      </p>
    </section>

    <section id="governing-law" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        10. Governing Law & Dispute Resolution
      </h2>
      <h3 class="text-lg font-semibold">10.1 Jurisdiction</h3>
      <p class="leading-relaxed">
        These Terms are governed by the laws of the Republic of the Philippines, without regard to
        conflict of law principles.
      </p>

      <h3 class="mt-6 text-lg font-semibold">10.2 Dispute Resolution</h3>
      <p class="leading-relaxed">Any disputes arising from these Terms shall be:</p>
      <ol class="ml-6 list-decimal space-y-2">
        <li>
          <strong>First attempted through informal resolution</strong> with the Organization's administrative
          team
        </li>
        <li><strong>Escalated to formal mediation</strong> if informal resolution fails</li>
        <li>
          <strong>Subject to the exclusive jurisdiction</strong> of the courts of Quezon City, Philippines
        </li>
      </ol>
    </section>

    <section id="contact" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">11. Contact & Support</h2>
      <p class="leading-relaxed">
        For questions, concerns, or disputes regarding these Terms, please contact:
      </p>
      <div class="space-y-1">
        <p class="font-bold">HAOne Development Team</p>
        <p class="opacity-80">Email: haone@googlegroups.com</p>
      </div>
    </section>

    <hr class="my-16 border-border" />

    <section id="appendix" class="space-y-6">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">Appendix A: Definitions</h2>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Platform</strong>: HAOne, including all associated software, data, and services
        </li>
        <li><strong>User</strong>: Any individual accessing the Platform</li>
        <li>
          <strong>Resident</strong>: A UPLB student residing in an Office of Student Housing
          (OSH)-managed residence hall
        </li>
        <li><strong>Organization</strong>: HAOne Development Team</li>
        <li>
          <strong>Data</strong>: Any personal, financial, or operational information processed by
          the Platform
        </li>
      </ul>

      <p class="mt-12 border-t border-border pt-12 text-center font-bold">
        These Terms of Service are effective as of April 2026 and supersede all prior agreements.
      </p>
    </section>
  </div>
</div>

<script lang="ts">
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import * as Table from "$ui/table/index.js";
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";

  onMount(() => {
    pageState.title = "Privacy Policy";
  });
</script>

<div class="container mx-auto max-w-4xl px-6 py-10">
  <div class="mb-8 flex items-center gap-3">
    <img src="/ha1.svg" alt="HAOne" class="h-10 w-10 dark:hidden" />
    <img src="/ha1_bw.svg" alt="HAOne" class="hidden h-10 w-10 dark:block" />
    <span class="text-xl font-bold tracking-tight">HAOne</span>
  </div>

  <ContentHeader
    title="Privacy Policy"
    subtitle="Last Updated: April 2026 • Effective Date: April 2026"
    href="/"
  />

  <div class="mt-12 space-y-12 text-foreground">
    <section id="introduction" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">1. Introduction</h2>
      <p class="leading-relaxed">
        HAOne Development Team ("we," "us," "our," "Data Controller," or the "Organization") is
        committed to protecting your privacy and ensuring transparent data practices. This Privacy
        Policy describes how we collect, use, disclose, and safeguard information when you use HAOne
        (the "Platform").
      </p>
      <p class="leading-relaxed">This Privacy Policy applies to:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>All users of HAOne</li>
        <li>Data collected through the Platform's web interface</li>
        <li>Integrated services (Google Cloud Services)</li>
      </ul>
      <p class="pt-2 leading-relaxed">
        Please read this Privacy Policy carefully. If you do not agree with our practices, do not
        use the Platform.
      </p>
    </section>

    <section id="information-collection" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">2. Information We Collect</h2>

      <h3 class="text-lg font-semibold">2.1 Information You Provide Directly</h3>
      <h4 class="mt-4 font-bold">Authentication & Identity</h4>
      <ul class="ml-6 list-disc space-y-2">
        <li><strong>Email address</strong> (<code>@up.edu.ph</code> domain required)</li>
        <li>
          <strong>Google Account credentials</strong> (name, profile picture, basic account information)
        </li>
        <li>
          <strong>User role & access level</strong> (resident, house council officer, finance personnel)
        </li>
      </ul>

      <h4 class="mt-6 font-bold">Financial & Account Data</h4>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Personal identification</strong>: Full name, student number, room assignment,
          residence hall assignment
        </li>
        <li>
          <strong>Financial transactions</strong>: Payment amounts, payment methods
          (cash/GCash/Maya/Gotyme Bank/MariBank), transaction dates
        </li>
        <li>
          <strong>Account balances</strong>: Water fees, association fees, miscellaneous charges,
          waivers, adjustments
        </li>
        <li>
          <strong>Payment history</strong>: All submitted and processed payments, receipt reference
          numbers
        </li>
        <li>
          <strong>Supporting documentation</strong>: Payment proofs, request justifications,
          adjustment documentation
        </li>
      </ul>

      <h4 class="mt-6 font-bold">Communications</h4>
      <ul class="ml-6 list-disc space-y-2">
        <li><strong>Payment notes</strong> (public remarks associated with transactions)</li>
        <li>
          <strong>Administrative notes</strong> (house council officer-entered observations on accounts)
        </li>
        <li><strong>Support requests</strong> and inquiries submitted through the Platform</li>
      </ul>

      <h3 class="mt-8 text-lg font-semibold">2.2 Information Collected Automatically</h3>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Login activity</strong>: Timestamp, IP address, browser/device information,
          session duration
        </li>
        <li>
          <strong>Platform interactions</strong>: Pages visited, export requests
        </li>
        <li>
          <strong>Device information</strong>: Operating system, browser type, screen resolution,
          language preferences
        </li>
        <li>
          <strong>Analytics data</strong>: Aggregated usage patterns, feature adoption rates, error
          logs
        </li>
        <li>
          <strong>Google Cloud Services data</strong>: Session authentication, communication logs,
          data synchronization logs, API call metadata
        </li>
      </ul>

      <h3 class="mt-8 text-lg font-semibold">2.3 Information from Third Parties</h3>
      <p class="leading-relaxed">We may receive information about you from:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Residence Hall Association-provided data</strong>: Room assignments, residence
          hall occupancy status, housing records, name, student number, email, college/degree
          program affiliation
        </li>
      </ul>
    </section>

    <section id="legal-basis" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">3. Legal Basis for Processing</h2>
      <p class="leading-relaxed">We process your information under the following legal grounds:</p>

      <h3 class="text-lg font-semibold">3.1 Contractual Performance</h3>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          Processing necessary to manage your housing account and financial obligations as a UPLB
          student resident
        </li>
        <li>Settlement of payments and maintenance of transaction records</li>
        <li>Generation of payment receipts and financial statements</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">3.2 Legal Compliance</h3>
      <ul class="ml-6 list-disc space-y-2">
        <li>Compliance with institutional financial reporting requirements</li>
        <li>Audit and regulatory obligations</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">3.3 Legitimate Interests</h3>
      <ul class="ml-6 list-disc space-y-2">
        <li>Platform security and fraud prevention</li>
        <li>System administration and technical maintenance</li>
        <li>Improvement of user experience and service delivery</li>
        <li>Communication of policy updates and service announcements</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">3.4 Consent</h3>
      <ul class="ml-6 list-disc space-y-2">
        <li>Additional marketing or institutional communications (opt-in basis)</li>
        <li>Processing of sensitive financial data beyond minimum requirements</li>
        <li>Sharing of data with external service providers</li>
      </ul>
    </section>

    <section id="how-we-use" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        4. How We Use Your Information
      </h2>

      <h3 class="text-lg font-semibold">4.1 Core Operations</h3>
      <ul class="ml-6 list-disc space-y-2">
        <li>Account creation and authentication management</li>
        <li>Financial transaction processing and ledger maintenance</li>
        <li>Payment receipt generation and archival</li>
        <li>Account balance calculations and billing</li>
        <li>Clearing and certification of full payment status</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">4.2 Administrative & Compliance</h3>
      <ul class="ml-6 list-disc space-y-2">
        <li>Audit and compliance verification</li>
        <li>Investigation of unauthorized access or fraud</li>
        <li>Enforcement of terms of service and institutional policies</li>
        <li>Record retention for institutional accountability</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">4.3 Communications</h3>
      <ul class="ml-6 list-disc space-y-2">
        <li>Sending payment confirmations and receipts</li>
        <li>Notifying student residents of account status changes</li>
        <li>Sending reminders for outstanding balances</li>
        <li>Providing administrative or system notifications</li>
        <li>Responding to support requests or inquiries</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">4.4 System Improvement</h3>
      <ul class="ml-6 list-disc space-y-2">
        <li>Analyzing Platform usage patterns and user behavior</li>
        <li>Identifying and resolving technical issues</li>
        <li>Optimizing performance and user experience</li>
        <li>Developing new features and administrative tools</li>
        <li>Conducting A/B testing and usability research</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">4.5 Security & Fraud Prevention</h3>
      <ul class="ml-6 list-disc space-y-2">
        <li>Detecting and preventing unauthorized access</li>
        <li>Identifying suspicious transaction patterns</li>
        <li>Protecting against malware and cyber threats</li>
        <li>Conducting security audits and penetration testing</li>
        <li>Investigating and resolving account disputes</li>
      </ul>
    </section>

    <section id="sharing" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">5. Data Sharing & Disclosure</h2>

      <h3 class="text-lg font-semibold">5.1 Third Parties We Share Data With</h3>
      <h4 class="mt-4 font-bold">Service Providers</h4>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Google Cloud Services</strong>: Infrastructure, authentication, communications,
          and data storage
        </li>
        <li>
          <strong>PDF Generation Services</strong> (if applicable): For secure receipt generation
        </li>
      </ul>

      <h4 class="mt-6 font-bold">Internal Sharing</h4>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Finance & Accounting Personnel</strong>: Access to transaction history, payment
          records, account balances
        </li>
        <li>
          <strong>House Council Officers</strong>: Residence hall management, room assignments,
          occupancy data, housing status
        </li>
        <li>
          <strong>Auditors & Compliance Personnel</strong>: Transaction verification, policy
          enforcement
        </li>
      </ul>

      <h4 class="mt-6 font-bold">Legal Requirements</h4>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Law Enforcement</strong>: If required by subpoena, court order, or legal process
        </li>
        <li>
          <strong>Regulatory Authorities</strong>: For compliance with institutional or governmental
          requirements
        </li>
        <li>
          <strong>Legal Proceedings</strong>: To defend the Organization against claims or disputes
        </li>
      </ul>

      <h3 class="mt-8 text-lg font-semibold">5.2 Data We Do NOT Share</h3>
      <p class="leading-relaxed">
        We do <strong>not</strong> sell, rent, or lease your personal data to third parties for marketing
        purposes. We do not disclose financial information to external lenders, employers, or third-party
        vendors except as legally required.
      </p>

      <h3 class="mt-8 text-lg font-semibold">5.3 International Data Transfers</h3>
      <p class="leading-relaxed">
        Your data may be processed on servers located outside the Philippines as part of Google
        Cloud Services. Such transfers are governed by data protection agreements and standard
        contractual clauses ensuring adequate safeguards.
      </p>
    </section>

    <section id="security" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">6. Data Security</h2>

      <h3 class="text-lg font-semibold">6.1 Security Measures</h3>
      <p class="leading-relaxed">We implement industry-standard security controls:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Access Control</strong>: Role-based access restrictions; only authorized personnel
          can view sensitive data
        </li>
        <li>
          <strong>Authentication</strong>: Google Cloud Services with mandatory
          <code>up.edu.ph</code> domain verification
        </li>
        <li>
          <strong>Activity Logging</strong>: All data access and modifications are logged for audit
          trails
        </li>
        <li>
          <strong>Regular Audits</strong>: Periodic security assessments and vulnerability testing
        </li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">6.2 Data Breach Response</h3>
      <p class="leading-relaxed">
        In the event of a data breach affecting your personal information, we will:
      </p>
      <ol class="ml-6 list-decimal space-y-2">
        <li>Investigate the scope and nature of the breach</li>
        <li>Notify affected individuals without unreasonable delay</li>
        <li>Provide guidance on protective measures</li>
        <li>Cooperate with relevant authorities and regulators</li>
        <li>Implement corrective measures to prevent recurrence</li>
      </ol>

      <h3 class="mt-6 text-lg font-semibold">6.3 Your Responsibility</h3>
      <p class="leading-relaxed">You are responsible for:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Maintaining the confidentiality of your login credentials</li>
        <li>Securing your device from unauthorized access</li>
        <li>Logging out after each session</li>
        <li>Reporting suspicious activity immediately</li>
      </ul>
    </section>

    <section id="retention" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">7. Data Retention</h2>

      <h3 class="text-lg font-semibold">7.1 Retention Periods</h3>
      <div class="mt-4 rounded-lg border">
        <Table.Root>
          <Table.Header>
            <Table.Row>
              <Table.Head>Data Type</Table.Head>
              <Table.Head>Retention Period</Table.Head>
              <Table.Head>Purpose</Table.Head>
            </Table.Row>
          </Table.Header>
          <Table.Body>
            <Table.Row>
              <Table.Cell class="font-medium">Authentication logs</Table.Cell>
              <Table.Cell>90 days</Table.Cell>
              <Table.Cell>Security monitoring, fraud detection</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell class="font-medium">Transaction records</Table.Cell>
              <Table.Cell>Indefinite</Table.Cell>
              <Table.Cell>Residence hall association financial records, audit trails</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell class="font-medium">Payment receipts</Table.Cell>
              <Table.Cell>Indefinite</Table.Cell>
              <Table.Cell
                >Financial accountability, resident access, residence hall records</Table.Cell
              >
            </Table.Row>
            <Table.Row>
              <Table.Cell class="font-medium">Session logs</Table.Cell>
              <Table.Cell>30 days</Table.Cell>
              <Table.Cell>Performance monitoring, troubleshooting</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell class="font-medium">Account balances</Table.Cell>
              <Table.Cell>Indefinite</Table.Cell>
              <Table.Cell>Residence hall association financial management</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell class="font-medium">Communications</Table.Cell>
              <Table.Cell>Indefinite</Table.Cell>
              <Table.Cell>Dispute resolution, documentation, residence hall records</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell class="font-medium">Support requests</Table.Cell>
              <Table.Cell>Indefinite</Table.Cell>
              <Table.Cell>Service improvement, reference, residence hall records</Table.Cell>
            </Table.Row>
            <Table.Row>
              <Table.Cell class="font-medium">System backups</Table.Cell>
              <Table.Cell>30 days</Table.Cell>
              <Table.Cell>Disaster recovery, data integrity</Table.Cell>
            </Table.Row>
          </Table.Body>
        </Table.Root>
      </div>

      <h3 class="mt-8 text-lg font-semibold">7.2 Deletion Upon Termination</h3>
      <p class="leading-relaxed">
        When your account is terminated (graduation, severance, or deactivation):
      </p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Access credentials are immediately revoked</li>
        <li>Personal profile data is archived but retained for 2 years</li>
        <li>
          Transaction records and financial data are retained indefinitely per legal requirements
        </li>
        <li>
          You may request deletion of non-financial personal data by contacting the Organization
        </li>
      </ul>
    </section>

    <section id="rights" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">8. Your Rights & Choices</h2>

      <h3 class="text-lg font-semibold">8.1 Access & Transparency</h3>
      <p class="leading-relaxed">You have the right to:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li><strong>Request access</strong> to your personal data held by the Organization</li>
        <li><strong>Receive a copy</strong> of your data in a portable format</li>
        <li><strong>Review transaction history</strong> anytime through the Platform</li>
        <li><strong>Obtain clarification</strong> on how your data is being processed</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">8.2 Correction & Rectification</h3>
      <p class="leading-relaxed">You have the right to:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Correct inaccurate information</strong> (name, contact details, account assignments)
        </li>
        <li><strong>Request amendment</strong> of incomplete data</li>
        <li><strong>Dispute transaction records</strong> if you believe they contain errors</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">8.3 Restriction & Erasure</h3>
      <p class="leading-relaxed">You may request:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Restriction of processing</strong> for specific data categories pending investigation
        </li>
        <li>
          <strong>Deletion of non-essential data</strong> (not financial or audit records, which are legally
          required)
        </li>
      </ul>
      <p class="pt-2 leading-relaxed">
        Submit such requests to the Organization's privacy contact (see Section 10).
      </p>

      <h3 class="mt-6 text-lg font-semibold">8.4 Opt-Out Options</h3>
      <p class="leading-relaxed">You can:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li><strong>Disable non-essential notifications</strong> through account settings</li>
        <li><strong>Opt out of promotional communications</strong> (if applicable)</li>
      </ul>
      <p class="pt-2 leading-relaxed italic">
        You cannot opt out of <strong>essential operational communications</strong> (payment confirmations,
        account status, policy updates).
      </p>
    </section>

    <section id="international" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        9. International Data Protection Regulations
      </h2>

      <h3 class="text-lg font-semibold">9.1 Philippines Data Privacy Act (RA 10173)</h3>
      <p class="leading-relaxed">
        This Privacy Policy complies with the Data Privacy Act of 2012 and the implementing National
        Privacy Commission (NPC) issuances. You have rights under this law including access,
        correction, and objection to processing.
      </p>
    </section>

    <section id="contact" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        10. Contact & Rights Management
      </h2>
      <h3 class="text-lg font-semibold">10.1 Privacy Questions & Requests</h3>
      <p class="leading-relaxed">For inquiries, complaints, or to exercise your data rights:</p>
      <div class="space-y-1">
        <p class="font-bold">HAOne Development Team</p>
        <p class="opacity-80">Email: haone@googlegroups.com</p>
        <p class="opacity-80">Response Time: Within 1 month</p>
      </div>

      <h3 class="mt-8 text-lg font-semibold">10.2 Regulatory Complaints</h3>
      <p class="leading-relaxed">If you believe your data privacy rights have been violated:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Philippines</strong>: File a complaint with the National Privacy Commission
          (https://www.privacy.gov.ph)
        </li>
        <li><strong>Other jurisdictions</strong>: Contact your relevant supervisory authority</li>
      </ul>
    </section>

    <section id="third-party" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        11. Third-Party Links & Services
      </h2>
      <p class="leading-relaxed">
        The Platform may contain links to third-party websites. We are not responsible for the
        privacy practices of third parties. We recommend reviewing their privacy policies
        independently.
      </p>
    </section>

    <section id="cookies" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        12. Cookies & Tracking Technologies
      </h2>
      <h3 class="text-lg font-semibold">12.1 Cookies Used</h3>
      <p class="leading-relaxed">The Platform uses cookies for:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li><strong>Session management</strong>: Maintaining login state</li>
        <li><strong>Authentication</strong>: Storing authentication tokens securely</li>
        <li><strong>Preferences</strong>: Remembering user settings (language, theme, density)</li>
        <li><strong>Analytics</strong>: Aggregated usage tracking (anonymized)</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">12.2 Cookie Control</h3>
      <p class="leading-relaxed">You can:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Disable non-essential cookies through browser settings</li>
        <li>Clear cookies at any time</li>
      </ul>
      <p class="pt-2 text-sm leading-relaxed italic">
        Disabling essential cookies may limit Platform functionality.
      </p>
    </section>

    <section id="updates" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        13. Policy Updates & Notification
      </h2>
      <h3 class="text-lg font-semibold">13.1 Changes to This Policy</h3>
      <p class="leading-relaxed">We may update this Privacy Policy to reflect:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Changes in Platform functionality</li>
        <li>New legal requirements</li>
        <li>Improvements in data protection practices</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">13.2 Notification</h3>
      <p class="leading-relaxed">We will notify you of material changes by:</p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Posting the updated policy on the Platform</li>
        <li>Sending notice via your registered email address</li>
        <li>Requiring re-acceptance of updated terms upon next login</li>
      </ul>
      <p class="pt-2 leading-relaxed">
        Continued use of the Platform constitutes acceptance of updates.
      </p>
    </section>

    <section id="dpa" class="space-y-4">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">
        14. Data Processing Agreement (for House Council Officers and Finance Personnel)
      </h2>
      <h3 class="text-lg font-semibold">14.1 Administrative Access</h3>
      <p class="leading-relaxed">
        House Council officers and finance personnel have elevated access to student resident data.
        By accepting this policy, they agree to:
      </p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Process data only for authorized administrative purposes</li>
        <li>Maintain strict confidentiality of all accessed information</li>
        <li>Report unauthorized access or data breaches immediately</li>
        <li>Comply with the Organization's data security policies</li>
        <li>Participate in annual privacy and security training</li>
      </ul>

      <h3 class="mt-6 text-lg font-semibold">14.2 Accountability</h3>
      <p class="leading-relaxed">
        Unauthorized access or misuse of student resident data will result in:
      </p>
      <ul class="ml-6 list-disc space-y-2">
        <li>Disciplinary action up to and including termination</li>
        <li>Civil or criminal liability where applicable</li>
        <li>Mandatory data protection training</li>
      </ul>
    </section>

    <hr class="my-16 border-border" />

    <section id="appendix" class="space-y-6">
      <h2 class="border-b pb-2 text-2xl font-bold tracking-tight">Appendix A: Definitions</h2>
      <ul class="ml-6 list-disc space-y-2">
        <li>
          <strong>Personal Data</strong>: Any information relating to an identified or identifiable
          individual
        </li>
        <li>
          <strong>Processing</strong>: Any operation performed on data (collection, storage, use,
          sharing, deletion)
        </li>
        <li><strong>Data Subject</strong>: The individual to whom personal data relates</li>
        <li><strong>Data Controller</strong>: The Organization (HAOne Development Team)</li>
        <li><strong>Data Processor</strong>: Third-party service providers (Google, Cloudflare)</li>
        <li>
          <strong>Data Breach</strong>: Unauthorized access, disclosure, or loss of personal data
        </li>
        <li>
          <strong>Legitimate Interests</strong>: Lawful reasons for processing that benefit the
          Organization or third parties
        </li>
        <li>
          <strong>Consent</strong>: Freely given, specific, informed, and unambiguous agreement to
          processing
        </li>
      </ul>

      <div class="mt-12 space-y-2 border-t border-border pt-12 text-center">
        <p class="font-bold">
          For questions regarding this Privacy Policy, please contact HAOne Development Team at
          haone@googlegroups.com
        </p>
        <p class="text-sm opacity-80">
          This Privacy Policy is effective as of April 2026 and supersedes all prior versions.
        </p>
      </div>
    </section>
  </div>
</div>

import { Elysia } from "elysia";
import { BaseHtml } from "../components/base";
import { Header } from "../components/header";
import {
  ACCOUNT_REGISTRATION,
  ALLOW_UNAUTHENTICATED,
  AUTO_DELETE_EVERY_N_HOURS,
  BRANDING,
  HIDE_HISTORY,
  HTTP_ALLOWED,
  LEGAL_CONTACT_EMAIL,
  LEGAL_EFFECTIVE_DATE,
  LEGAL_ENTITY_NAME,
  LEGAL_GOVERNING_LAW,
  REFUND_WINDOW_DAYS,
  UNAUTHENTICATED_USER_SHARING,
  WEBROOT,
} from "../helpers/env";
import { USAGE_RETENTION_DAYS } from "../services/quota";
import { userService } from "./user";

const SOURCE_CODE_URL = "https://github.com/C4illin/ConvertX";

// Missing operator details stay visibly marked instead of being invented
const Placeholder = ({ children }: { children: string }) => (
  <mark
    class="
    rounded-sm bg-amber-400/25 px-1 text-amber-700
    dark:text-amber-300
  "
    safe
  >
    [{children}]
  </mark>
);

const Entity = () =>
  LEGAL_ENTITY_NAME ? (
    <span safe>{LEGAL_ENTITY_NAME}</span>
  ) : (
    <Placeholder>legal company name</Placeholder>
  );

const ContactEmail = () =>
  LEGAL_CONTACT_EMAIL ? (
    <a
      href={`mailto:${LEGAL_CONTACT_EMAIL}`}
      class="
        text-accent-600 underline
        dark:text-accent-400
      "
      safe
    >
      {LEGAL_CONTACT_EMAIL}
    </a>
  ) : (
    <Placeholder>contact email</Placeholder>
  );

const LegalLink = ({ path, children }: { path: string; children: string }) => (
  <a
    href={`${WEBROOT}${path}`}
    class="
    text-accent-600 underline
    dark:text-accent-400
  "
  >
    {children}
  </a>
);

const Section = ({ title, children }: { title: string; children: JSX.Element | JSX.Element[] }) => (
  <section class="mb-8">
    <h2
      class="
      mb-3 text-xl font-bold text-slate-900
      dark:text-white
    "
      safe
    >
      {title}
    </h2>
    <div
      class="
      space-y-3 leading-relaxed text-slate-700
      dark:text-neutral-300
    "
    >
      {children}
    </div>
  </section>
);

const List = ({ children }: { children: JSX.Element[] }) => (
  <ul class="list-disc space-y-1.5 pl-6">{children}</ul>
);

const fileRetention =
  AUTO_DELETE_EVERY_N_HOURS > 0
    ? "automatically deleted according to your plan's retention period (2 hours for free conversions, 24 hours for Pro, and 7 days for Business; the cleanup runs every 15 minutes)"
    : "kept until you delete them from your conversion history";

const LegalPage = ({
  title,
  loggedIn,
  children,
}: {
  title: string;
  loggedIn: boolean;
  children: JSX.Element[];
}) => (
  <BaseHtml webroot={WEBROOT} title={`${BRANDING} | ${title}`}>
    <>
      <Header
        webroot={WEBROOT}
        branding={BRANDING}
        accountRegistration={ACCOUNT_REGISTRATION}
        allowUnauthenticated={ALLOW_UNAUTHENTICATED}
        hideHistory={HIDE_HISTORY}
        loggedIn={loggedIn}
      />
      <main
        class="
        mx-auto w-full max-w-3xl flex-1 px-4 py-12
        sm:px-6
      "
      >
        <h1
          class="
            mb-2 text-3xl font-extrabold tracking-tight text-slate-900
            sm:text-4xl
            dark:text-white
          "
          safe
        >
          {title}
        </h1>
        <p
          class="
          mb-10 text-sm text-slate-500
          dark:text-neutral-400
        "
        >
          Effective date:{" "}
          {LEGAL_EFFECTIVE_DATE ? (
            <span safe>{LEGAL_EFFECTIVE_DATE}</span>
          ) : (
            <Placeholder>date</Placeholder>
          )}
        </p>
        {children}
        <nav
          class="
          mt-12 flex flex-wrap gap-4 border-t border-slate-200 pt-6 text-sm
          dark:border-neutral-800
        "
        >
          <LegalLink path="/terms">Terms of Service</LegalLink>
          <LegalLink path="/privacy">Privacy Policy</LegalLink>
          <LegalLink path="/refunds">Refund Policy</LegalLink>
        </nav>
      </main>
    </>
  </BaseHtml>
);

export const legal = new Elysia()
  .use(userService)
  .resolve(async ({ jwt, cookie: { auth } }) => ({
    loggedIn: auth?.value ? Boolean(await jwt.verify(auth.value as string)) : false,
  }))
  .get("/terms", ({ loggedIn }) => (
    <LegalPage title="Terms of Service" loggedIn={loggedIn}>
      <Section title="1. Agreement">
        <p>
          These terms govern your use of <span safe>{BRANDING}</span> (the "Service"), operated by{" "}
          <Entity /> ("we", "us"). By using the Service you agree to these terms and to our{" "}
          <LegalLink path="/privacy">Privacy Policy</LegalLink>. If you do not agree, do not use the
          Service.
        </p>
      </Section>

      <Section title="2. The Service">
        <p>
          The Service converts files between formats. It is offered on a free plan and on paid
          plans. The limits of each plan, such as maximum file size, files per conversion and
          conversions per day, are shown on our <LegalLink path="/#pricing">pricing page</LegalLink>
          . We may change features and limits; changes to a paid plan you already pay for take
          effect at your next renewal, and we will tell you in advance.
        </p>
      </Section>

      <Section title="3. Accounts">
        <p>
          You must give a valid email address and keep your password secret. You are responsible for
          activity under your account. An account is for one person; do not share it or create
          several accounts to get around plan limits.
        </p>
      </Section>

      <Section title="4. Acceptable use">
        <p>You must not use the Service to:</p>
        <List>
          <li>
            upload or convert content that is illegal or that you do not have the right to use;
          </li>
          <li>upload malware or files designed to harm the Service or other users;</li>
          <li>
            bypass plan limits, rate limits or security measures, including through automation;
          </li>
          <li>attack, overload or probe the Service, or access other users' files or accounts.</li>
        </List>
        <p>We may suspend or remove access and delete files that break these rules.</p>
      </Section>

      <Section title="5. Your files">
        <p>
          You keep all rights to the files you upload. You give us permission to store and process
          them only to perform the conversions you request. Files are {fileRetention}, as described
          in the <LegalLink path="/privacy">Privacy Policy</LegalLink>. We do not keep backups of
          your files, so keep your own copies.
        </p>
      </Section>

      <Section title="6. Paid plans and billing">
        <p>
          Our order process is conducted by our online reseller Paddle.com. Paddle.com is the
          Merchant of Record for all our orders. Paddle provides all customer service inquiries and
          handles returns.
        </p>
        <p>
          Paid plans are subscriptions that renew automatically each billing period until you
          cancel. You can cancel at any time from your account page; your plan stays active until
          the end of the period you have paid for. Taxes are calculated and collected by Paddle.
          Refunds are covered by our <LegalLink path="/refunds">Refund Policy</LegalLink>.
        </p>
      </Section>

      <Section title="7. Availability">
        <p>
          We work to keep the Service available and conversions accurate, but unless a separate
          written agreement with you says otherwise, the Service is provided "as is" and "as
          available", without warranties of any kind, and some conversions may fail or lose
          formatting.
        </p>
      </Section>

      <Section title="8. Limitation of liability">
        <p>
          To the extent permitted by law, we are not liable for indirect or consequential losses, or
          for loss of data, profits or business. Our total liability for any claim is limited to the
          amount you paid us in the 12 months before the claim. Nothing in these terms limits rights
          you have as a consumer that cannot be limited by law.
        </p>
      </Section>

      <Section title="9. Open source">
        <p>
          The Service is based on ConvertX, free software licensed under the GNU Affero General
          Public License v3. The source code of the software running the Service is available at{" "}
          <a
            href={SOURCE_CODE_URL}
            class="
            text-accent-600 underline
            dark:text-accent-400
          "
          >
            {SOURCE_CODE_URL}
          </a>
          .
        </p>
      </Section>

      <Section title="10. Ending your use">
        <p>
          You can stop using the Service at any time and ask us to delete your account. We may
          suspend or end your access if you break these terms. Sections 5, 8 and 11 continue to
          apply after your access ends.
        </p>
      </Section>

      <Section title="11. Governing law">
        <p>
          These terms are governed by the laws of{" "}
          {LEGAL_GOVERNING_LAW ? (
            <span safe>{LEGAL_GOVERNING_LAW}</span>
          ) : (
            <Placeholder>country or state</Placeholder>
          )}
          , without affecting any mandatory consumer protections of the country where you live.
        </p>
      </Section>

      <Section title="12. Changes and contact">
        <p>
          We may update these terms. If a change is significant we will notify account holders by
          email or on the Service before it takes effect. Questions: <ContactEmail />.
        </p>
      </Section>
    </LegalPage>
  ))
  .get("/privacy", ({ loggedIn }) => (
    <LegalPage title="Privacy Policy" loggedIn={loggedIn}>
      <Section title="Who we are">
        <p>
          <Entity /> operates <span safe>{BRANDING}</span> and is responsible for the personal data
          described here. Contact: <ContactEmail />.
        </p>
      </Section>

      <Section title="What we collect">
        <List>
          <li>
            <strong>Account details:</strong> your email address and your password, which is stored
            only as a secure hash.
          </li>
          <li>
            <strong>Your files:</strong> the files you upload, the converted results and their file
            names.
          </li>
          <li>
            <strong>Usage counters:</strong> how many conversions you made each day, used to enforce
            plan limits. For visitors without an account this counter is tied to your IP address.
          </li>
          <li>
            <strong>Subscription details:</strong> if you buy a plan, we receive your Paddle
            customer ID, subscription ID and subscription status. Paddle handles your payment
            details; we never see your card number.
          </li>
        </List>
      </Section>

      <Section title="How we use it">
        <p>
          We use this data only to run the Service: to convert your files, keep you signed in,
          enforce plan limits, manage your subscription and answer your requests. We do not sell
          your data, and we do not open or inspect your files except when needed to fix a problem
          you report or when required by law.
        </p>
      </Section>

      <Section title="Cookies and local storage">
        <List>
          <li>
            <code>auth</code>: keeps you signed in (7 days for accounts, 24 hours for visitors
            without an account).
          </li>
          <li>
            <code>jobId</code>: links your uploads to the current conversion (24 hours).
          </li>
          <li>
            Your browser's local storage remembers your theme and recently used formats. This stays
            on your device and is not sent to us.
          </li>
        </List>
        <p>
          These are strictly necessary for the Service to work. We do not use advertising or
          tracking cookies.
        </p>
      </Section>

      <Section title="Who we share it with">
        <List>
          <li>
            <strong>Paddle</strong>, our Merchant of Record, which processes payments, taxes and
            invoices under its own privacy policy.
          </li>
          <li>
            <strong>Infrastructure providers</strong> that host and deliver the Service, such as our
            server and network providers, which may process your IP address to deliver traffic and
            protect against attacks.
          </li>
          <li>Authorities, where the law requires it.</li>
        </List>
      </Section>

      <Section title="How long we keep it">
        <List>
          <li>Uploaded and converted files, and their file names, are {fileRetention}.</li>
          <li>Usage counters are deleted after {String(USAGE_RETENTION_DAYS)} days.</li>
          <li>
            Account and subscription details are kept until you ask us to delete your account.
          </li>
        </List>
        {UNAUTHENTICATED_USER_SHARING ? (
          <p>
            Visitors without an account share one conversion history, so their files can be seen by
            other visitors. Create an account to keep your files private.
          </p>
        ) : (
          <></>
        )}
      </Section>

      <Section title="Your rights">
        <p>
          You can view and change your email and password on your account page and delete
          conversions from your history. To get a copy of your data, correct it or delete your
          account, email <ContactEmail />. Depending on where you live you may also have the right
          to object to processing and to complain to your data protection authority.
        </p>
      </Section>

      <Section title="Security">
        <p>
          {HTTP_ALLOWED ? "" : "Traffic to the Service is encrypted with HTTPS, "}
          {HTTP_ALLOWED ? "Passwords" : "passwords"} are hashed, and files are stored separately for
          each user and deleted on the schedule above.
        </p>
      </Section>

      <Section title="Children">
        <p>The Service is not directed at children under 16.</p>
      </Section>

      <Section title="Changes">
        <p>
          We will post any changes on this page and update the effective date. If a change is
          significant we will notify account holders by email.
        </p>
      </Section>
    </LegalPage>
  ))
  .get("/refunds", ({ loggedIn }) => (
    <LegalPage title="Refund Policy" loggedIn={loggedIn}>
      <Section title="Money-back guarantee">
        <p>
          If you are not happy with a paid plan, you can request a full refund within{" "}
          {String(REFUND_WINDOW_DAYS)} days of your first payment or of any renewal payment.
        </p>
      </Section>

      <Section title="How to request a refund">
        <p>
          Our orders are processed by Paddle.com, our Merchant of Record, which handles refunds.
          Request a refund through the link in your Paddle receipt email, at{" "}
          <a
            href="https://paddle.net"
            class="
            text-accent-600 underline
            dark:text-accent-400
          "
          >
            paddle.net
          </a>
          , or by emailing us at <ContactEmail /> with the email address you used to pay. Refunds go
          back to your original payment method.
        </p>
      </Section>

      <Section title="Cancelling">
        <p>
          You can cancel your subscription at any time from your account page. You keep your paid
          plan until the end of the period you have paid for, and you will not be charged again.
          When a payment is refunded, the related subscription may be cancelled and your account
          returns to the free plan.
        </p>
      </Section>

      <Section title="After the refund window">
        <p>
          After {String(REFUND_WINDOW_DAYS)} days we do not normally refund the current billing
          period, but you can cancel to stop future charges. This does not affect any refund rights
          you have under the consumer laws of your country.
        </p>
      </Section>
    </LegalPage>
  ));

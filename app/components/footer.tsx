import { Link } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Phone as PhoneIcon,
  Mail,
  MapPin,
  Clock,
  Facebook,
  MessageCircle,
  Apple,
} from "lucide-react";
import { openWhatsApp } from "~/utils/functions/whatsapp";

const PHONE_NUMBER = "8562091082600";
const PHONE_DISPLAY = "+856 20 9108 2600";
const EMAIL = "xaosao95@gmail.com";

/**
 * Footer — editorial light variant.
 *
 * No background image, no dark wash. Four-column information grid on
 * top, a divider, and a row with social icons on the left + language
 * switcher + scroll-to-top on the right. Matches the modern landing
 * page reference.
 */
export function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="bg-white text-gray-700 pt-20 pb-10">
      <div className="max-w-7xl mx-auto px-6 lg:px-8">
        {/* ── Top: 4-column info grid ─────────────────────────────── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-10 lg:gap-12">
          {/* Brand */}
          <div className="md:col-span-5 lg:col-span-5">
            <div className="flex items-center gap-2.5">
              <img
                src="/images/icon.png"
                alt="XaoSao"
                width={36}
                height={36}
                className="w-9 h-9 rounded-lg shadow-sm ring-1 ring-black/5"
              />
              <span className="flex font-serif text-xl text-gray-900 tracking-tight font-semibold">
                Xaosao<span className="hidden sm:block text-rose-500">-ເຊົ່າສາວ</span>
              </span>
            </div>

            <p className="mt-5 text-gray-500 text-sm leading-relaxed max-w-md">
              {t("footer.description", {
                defaultValue:
                  "Lao's #1 companion platform — discover verified Sao, book a date, share your moments.",
              })}
            </p>

            <ul className="mt-7 space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <PhoneIcon className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <a
                  href={`tel:+${PHONE_NUMBER}`}
                  className="hover:text-rose-500 transition-colors"
                >
                  {PHONE_DISPLAY}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <Mail className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <a
                  href={`mailto:${EMAIL}`}
                  className="hover:text-rose-500 transition-colors"
                >
                  {EMAIL}
                </a>
              </li>
              <li className="flex items-center gap-3">
                <MapPin className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span>
                  {t("footer.location", {
                    defaultValue: "Vientiane Capital, Lao PDR",
                  })}
                </span>
              </li>
              <li className="flex items-center gap-3">
                <Clock className="w-4 h-4 text-rose-500 flex-shrink-0" />
                <span>
                  {t("footer.hours", {
                    defaultValue: "Mon–Fri · 08:30–17:30",
                  })}
                </span>
              </li>
            </ul>

            {/* App store badges */}
            <div className="mt-8">
              <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400 mb-3">
                {t("footer.availableOn", { defaultValue: "Available on your phone" })}
              </div>
              <div className="flex flex-wrap gap-2.5">
                <a
                  href="#"
                  aria-label="App Store"
                  className="relative inline-flex items-center gap-2.5 bg-gray-900 hover:bg-black text-white rounded-xl px-4 py-2.5 shadow-sm transition-all hover:scale-[1.02]"
                >
                  <Apple className="w-6 h-6" />
                  <div className="text-left leading-tight">
                    <div className="text-[9px] uppercase tracking-wider opacity-70">
                      {t("footer.appStorePrefix", { defaultValue: "Download on" })}
                    </div>
                    <div className="text-sm font-semibold">App Store</div>
                  </div>
                  <span className="absolute -top-2 -right-2 bg-amber-100 text-amber-700 text-[9px] font-bold px-2 py-0.5 rounded-full ring-1 ring-amber-200 shadow-sm">
                    {t("footer.comingSoon", { defaultValue: "COMING SOON" })}
                  </span>
                </a>

                <a
                  href="#"
                  aria-label="Google Play"
                  className="inline-flex items-center gap-2.5 bg-gray-900 hover:bg-black text-white rounded-xl px-4 py-2.5 shadow-sm transition-all hover:scale-[1.02]"
                >
                  <svg viewBox="0 0 24 24" className="w-6 h-6" fill="currentColor">
                    <path d="M3.609 1.814 13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893 2.302 2.302-10.937 6.333 8.635-8.635zm3.171-4.235 2.853 1.653a1 1 0 0 1 0 1.75l-2.853 1.653-2.498-2.498 2.498-2.558zM5.864 2.658 16.802 8.99l-2.302 2.302L5.864 2.658z" />
                  </svg>
                  <div className="text-left leading-tight">
                    <div className="text-[9px] uppercase tracking-wider opacity-70">
                      {t("footer.googlePlayPrefix", { defaultValue: "Get it on" })}
                    </div>
                    <div className="text-sm font-semibold">Google Play</div>
                  </div>
                </a>
              </div>
            </div>
          </div>

          {/* THE APP */}
          <FooterColumn title={t("footer.col.app", { defaultValue: "The app" })} className="md:col-span-3 lg:col-span-2">
            <FooterLink to="#download">
              {t("footer.app.ios", { defaultValue: "Download for iOS" })}
            </FooterLink>
            <FooterLink to="#download">
              {t("footer.app.android", { defaultValue: "Download for Android" })}
            </FooterLink>
            <FooterLink to="/video-tutorials">
              {t("footer.app.tour", { defaultValue: "App tour" })}
            </FooterLink>
            <FooterLink to="#download">
              {t("footer.app.faq", { defaultValue: "FAQ" })}
            </FooterLink>
          </FooterColumn>

          {/* COMPANY */}
          <FooterColumn title={t("footer.col.company", { defaultValue: "Company" })} className="md:col-span-2 lg:col-span-2">
            <FooterLink to="/terms-conditions">
              {t("footer.company.about", { defaultValue: "About us" })}
            </FooterLink>
            <FooterLink to={`tel:+${PHONE_NUMBER}`} external>
              {t("footer.company.contact", { defaultValue: "Contact" })}
            </FooterLink>
          </FooterColumn>

          {/* LEGAL */}
          <FooterColumn title={t("footer.col.legal", { defaultValue: "Legal" })} className="md:col-span-2 lg:col-span-3">
            <FooterLink to="/terms-conditions">
              {t("footer.legal.terms", {
                defaultValue: "Terms & conditions",
              })}
            </FooterLink>
            <FooterLink to="/privacy-policy">
              {t("footer.legal.privacy", {
                defaultValue: "Privacy policy",
              })}
            </FooterLink>
          </FooterColumn>
        </div>

        {/* ── Bottom: divider + socials + lang + back-to-top ─────── */}
        <div className="mt-16 pt-8 border-t border-rose-300">
          <div className="flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between">
            {/* Socials */}
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-400">
                {t("footer.followUs", { defaultValue: "Follow XaoSao" })}
              </span>
              <div className="flex gap-2">
                <SocialButton
                  href="https://www.facebook.com/profile.php?id=61585969554361"
                  label="Facebook"
                >
                  <Facebook className="w-4 h-4" />
                </SocialButton>
                <SocialButton
                  onClick={() => openWhatsApp(PHONE_NUMBER)}
                  label="WhatsApp"
                >
                  <MessageCircle className="w-4 h-4" />
                </SocialButton>
                <SocialButton
                  href="https://www.youtube.com/@xaosao-%E0%BB%80%E0%BA%8A%E0%BA%BB%E0%BB%88%E0%BA%B2%E0%BA%AA%E0%BA%B2%E0%BA%A7"
                  label="YouTube"
                >
                  {/* Inline YouTube glyph */}
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor" aria-hidden="true">
                    <path d="M23.498 6.186a2.969 2.969 0 0 0-2.087-2.103C19.504 3.546 12 3.546 12 3.546s-7.504 0-9.411.537A2.969 2.969 0 0 0 .502 6.186 31.27 31.27 0 0 0 0 12a31.27 31.27 0 0 0 .502 5.814 2.969 2.969 0 0 0 2.087 2.103C4.496 20.454 12 20.454 12 20.454s7.504 0 9.411-.537a2.969 2.969 0 0 0 2.087-2.103A31.27 31.27 0 0 0 24 12a31.27 31.27 0 0 0-.502-5.814zM9.6 15.6V8.4l6.4 3.6-6.4 3.6z" />
                  </svg>
                </SocialButton>
                <SocialButton
                  href={`tel:+${PHONE_NUMBER}`}
                  label="Phone"
                >
                  <PhoneIcon className="w-4 h-4" />
                </SocialButton>
              </div>
            </div>

            {/* Scroll-to-top now lives at the app root as a floating
                button — see components/scroll-to-top.tsx. */}
          </div>

          {/* Copyright line */}
          <p className="mt-6 text-xs text-gray-400">
            {t("footer.copyright", {
              defaultValue: "© 2026 XaoSao. All rights reserved.",
            })}
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ─── Helpers ──────────────────────────────────────────────────── */

function FooterColumn({
  title,
  children,
  className = "",
}: {
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <h3 className="text-[12px] font-semibold uppercase tracking-[0.18em] text-gray-900 mb-5 text-rose-500">
        {title}
      </h3>
      <ul className="space-y-3 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({
  to,
  children,
  external,
}: {
  to: string;
  children: React.ReactNode;
  external?: boolean;
}) {
  // Anchor-style targets (mailto, tel, #hash) bypass react-router.
  const isAnchor =
    external || to.startsWith("#") || to.startsWith("mailto:") || to.startsWith("tel:");

  if (isAnchor) {
    return (
      <li>
        <a
          href={to}
          onClick={(e) => {
            if (to.startsWith("#")) {
              e.preventDefault();
              const el = document.getElementById(to.slice(1));
              if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
            }
          }}
          className="text-gray-500 hover:text-rose-500 transition-colors hover:underline"
        >
          {children}
        </a>
      </li>
    );
  }

  return (
    <li>
      <Link to={to} className="text-gray-500 hover:text-rose-500 transition-colors hover:underline">
        {children}
      </Link>
    </li>
  );
}

function SocialButton({
  href,
  onClick,
  label,
  children,
}: {
  href?: string;
  onClick?: () => void;
  label: string;
  children: React.ReactNode;
}) {
  const className =
    "w-10 h-10 rounded-xl bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center transition-all hover:scale-105 hover:underline";

  if (href) {
    return (
      <a
        href={href}
        target={href.startsWith("http") ? "_blank" : undefined}
        rel={href.startsWith("http") ? "noopener noreferrer" : undefined}
        aria-label={label}
        className={className}
      >
        {children}
      </a>
    );
  }
  return (
    <button onClick={onClick} aria-label={label} className={className}>
      {children}
    </button>
  );
}

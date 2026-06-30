import { useState, useEffect } from "react";
import { useNavigate, Form, useNavigation, useActionData } from "react-router";
import { useTranslation } from "react-i18next";
import type { Route } from "./+types/deactivate";
import {
  AlertTriangle,
  ShieldX,
  EyeOff,
  Trash2,
  Clock,
  ArrowRight,
  Bell,
  Pause,
  MessageCircle,
  Mail,
  Phone,
  Lock,
  Loader2,
  CheckCircle2,
  Eye,
  Users,
  Crown,
} from "lucide-react";
import { Header } from "~/components/header";
import { Footer } from "~/components/footer";
import { deactivateByCredentials } from "~/services/deactivate.server";

export function meta(_: Route.MetaArgs) {
  const title = "Deactivate Account | XaoSao";
  const description =
    "Deactivate your XaoSao account. Verify with your phone and password — no need to log in first.";
  return [
    { title },
    { name: "description", content: description },
    { name: "robots", content: "noindex, nofollow" },
  ];
}

/* ─── Action: credentials-only deactivation ─────────────────────────
 *
 * Looks up the customer or model by phone, verifies the password with
 * bcrypt, then calls the existing delete helpers. No session is
 * required — this page is for users who don't want to log in first.
 *
 * Returns { ok: true } on success or { ok: false, error: <code> }
 * so the UI can render a localized error message inline.
 */
export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  return deactivateByCredentials({
    userType: (form.get("userType") as "customer" | "model") ?? "customer",
    phone: (form.get("phone") as string) ?? "",
    password: (form.get("password") as string) ?? "",
    reason: (form.get("reason") as string) || undefined,
  });
}

/**
 * Public deactivate-account page.
 *
 * Editorial light theme matching the home page:
 *   1. Hero — title + reassurance copy
 *   2. "What happens" — 4 outcome cards
 *   3. "Before you go" — softer alternatives (pause / hide / mute)
 *   4. Confirmation form — pick account type, enter phone + password
 *   5. Need help — support contact card
 *
 * No login required. The action verifies credentials with bcrypt and
 * calls the existing delete helpers on success.
 */
export default function Deactivate() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const navigation = useNavigation();
  const actionData = useActionData<typeof action>();

  const [userType, setUserType] = useState<"customer" | "model">("customer");
  const [reason, setReason] = useState<string>("");
  const [showPassword, setShowPassword] = useState(false);
  const [succeeded, setSucceeded] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  // Flip to the success screen once the action returns ok.
  useEffect(() => {
    if (actionData?.ok) setSucceeded(true);
  }, [actionData]);

  const errorCode = actionData && !actionData.ok ? actionData.error : null;
  const errorMessage = errorCode
    ? t(errorCode, { defaultValue: humanizeError(errorCode) })
    : null;

  const outcomes = [
    {
      icon: EyeOff,
      title: t("deactivate.outcomes.profile.title", {
        defaultValue: "Your profile disappears",
      }),
      desc: t("deactivate.outcomes.profile.desc", {
        defaultValue:
          "Your photos, bio, and listing are removed from Discover and search. No one can find or contact you.",
      }),
    },
    {
      icon: Trash2,
      title: t("deactivate.outcomes.data.title", {
        defaultValue: "Your data is deleted",
      }),
      desc: t("deactivate.outcomes.data.desc", {
        defaultValue:
          "Messages, posts, ratings, and wallet history are permanently erased. We keep only what the law requires.",
      }),
    },
    {
      icon: ShieldX,
      title: t("deactivate.outcomes.bookings.title", {
        defaultValue: "Active bookings cancelled",
      }),
      desc: t("deactivate.outcomes.bookings.desc", {
        defaultValue:
          "Pending and confirmed bookings will be cancelled and refunded. Completed bookings stay in the other party's history.",
      }),
    },
    {
      icon: Clock,
      title: t("deactivate.outcomes.permanent.title", {
        defaultValue: "It's permanent",
      }),
      desc: t("deactivate.outcomes.permanent.desc", {
        defaultValue:
          "You cannot recover the account. If you change your mind later you'll need to sign up again from scratch.",
      }),
    },
  ];

  const alternatives = [
    {
      icon: Pause,
      title: t("deactivate.alts.pause.title", {
        defaultValue: "Pause your profile",
      }),
      desc: t("deactivate.alts.pause.desc", {
        defaultValue:
          "Hide your profile temporarily without losing any data. Resume any time with one tap.",
      }),
      cta: t("deactivate.alts.pause.cta", { defaultValue: "Pause instead" }),
      href: "/customer/setting-detail/profile-visibility",
    },
    {
      icon: Bell,
      title: t("deactivate.alts.mute.title", {
        defaultValue: "Mute notifications",
      }),
      desc: t("deactivate.alts.mute.desc", {
        defaultValue:
          "Too many pings? Turn off push, SMS, or email — keep your account, lose the noise.",
      }),
      cta: t("deactivate.alts.mute.cta", { defaultValue: "Notification settings" }),
      href: "/customer/setting-detail/notifications",
    },
    {
      icon: MessageCircle,
      title: t("deactivate.alts.support.title", {
        defaultValue: "Talk to support",
      }),
      desc: t("deactivate.alts.support.desc", {
        defaultValue:
          "Stuck on something? Our team might be able to help before you go.",
      }),
      cta: t("deactivate.alts.support.cta", { defaultValue: "Contact us" }),
      href: "tel:+8562091082600",
    },
  ];

  const reasons = [
    { value: "not_useful", label: t("deactivate.reasons.notUseful", { defaultValue: "Not useful for me right now" }) },
    { value: "privacy", label: t("deactivate.reasons.privacy", { defaultValue: "Privacy concerns" }) },
    { value: "too_many_notifs", label: t("deactivate.reasons.notifs", { defaultValue: "Too many notifications" }) },
    { value: "found_someone", label: t("deactivate.reasons.found", { defaultValue: "I found a partner" }) },
    { value: "bad_experience", label: t("deactivate.reasons.bad", { defaultValue: "Bad experience on the platform" }) },
    { value: "other", label: t("deactivate.reasons.other", { defaultValue: "Something else" }) },
  ];

  return (
    <div className="min-h-screen bg-[#fffbf8] text-gray-900 font-sans antialiased">
      <Header />

      {/* ─── Hero ───────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-32 sm:pt-40 pb-16 sm:pb-24">
        <div className="absolute top-0 right-0 w-[40rem] h-[40rem] bg-rose-200/30 rounded-full blur-3xl -translate-y-1/3 translate-x-1/3 pointer-events-none" />

        <div className="relative max-w-3xl mx-auto px-6 lg:px-8 text-center">
          <div className="inline-flex items-center gap-2 bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full mb-6">
            <AlertTriangle className="w-3.5 h-3.5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              {t("deactivate.tag", { defaultValue: "Deactivate account" })}
            </span>
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-gray-900 leading-[1.05] tracking-tight">
            {t("deactivate.title", {
              defaultValue: "We're sorry to see you go.",
            })}
          </h1>

          <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-2xl mx-auto">
            {t("deactivate.subtitle", {
              defaultValue:
                "Deactivating your XaoSao account is permanent. Take a moment to read what happens — there might be a softer option below that fits better.",
            })}
          </p>
        </div>
      </section>

      {/* ─── What happens ───────────────────────────────────────── */}
      <section className="bg-white py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-12 sm:mb-16">
            <div className="inline-flex items-center bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full mb-4">
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                {t("deactivate.outcomes.tag", { defaultValue: "What happens" })}
              </span>
            </div>
            <h2 className="font-sans text-3xl sm:text-4xl lg:text-5xl text-gray-900 leading-[1.1] tracking-tight">
              {t("deactivate.outcomes.titleLead", {
                defaultValue: "When you deactivate,",
              })}{" "}
              <span className="text-rose-500">
                {t("deactivate.outcomes.titleAccent", {
                  defaultValue: "everything goes.",
                })}
              </span>
            </h2>
          </div>

          <div className="grid sm:grid-cols-2 gap-5">
            {outcomes.map((o) => (
              <div
                key={o.title}
                className="flex items-start gap-5 bg-[#fff8f5] rounded-2xl p-6 ring-1 ring-rose-100/60"
              >
                <div className="flex-shrink-0 w-12 h-12 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md shadow-rose-500/20">
                  <o.icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="text-gray-900 mb-1.5">{o.title}</h3>
                  <p className="text-sm text-gray-600 leading-relaxed">{o.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section >

      {/* ─── Alternatives ───────────────────────────────────────── */}
      <section className="bg-[#fffbf8] py-20 sm:py-28">
        <div className="max-w-7xl mx-auto px-6 lg:px-8">
          <div className="max-w-2xl mb-12 sm:mb-16">
            <div className="inline-flex items-center bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full mb-4">
              <span className="text-xs font-semibold uppercase tracking-[0.18em]">
                {t("deactivate.alts.tag", { defaultValue: "Before you go" })}
              </span>
            </div>
            <h2 className="font-sans text-3xl sm:text-4xl lg:text-5xl text-gray-900 leading-[1.1] tracking-tight">
              {t("deactivate.alts.title", {
                defaultValue: "Maybe try one of these first.",
              })}
            </h2>
            <p className="mt-4 text-gray-500 text-base sm:text-lg leading-relaxed">
              {t("deactivate.alts.subtitle", {
                defaultValue:
                  "These options keep your account safe so you don't have to start over later.",
              })}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {alternatives.map((a) => (
              <div
                key={a.title}
                className="bg-white rounded-3xl border-2 border-rose-100 p-7 transition-all hover:border-rose-300 hover:shadow-xl hover:-translate-y-0.5"
              >
                <div className="w-12 h-12 rounded-2xl bg-rose-50 flex items-center justify-center mb-5">
                  <a.icon className="w-5 h-5 text-rose-500" strokeWidth={1.75} />
                </div>
                <h3 className="font-bold text-gray-900 mb-2 text-lg">{a.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed mb-5">
                  {a.desc}
                </p>
                <button
                  onClick={() => {
                    if (a.href.startsWith("tel:")) {
                      window.location.href = a.href;
                    } else {
                      navigate(`/login?redirect=${encodeURIComponent(a.href)}`);
                    }
                  }}
                  className="inline-flex items-center gap-1.5 text-sm font-semibold text-rose-500 hover:text-rose-600 transition-colors"
                >
                  {a.cta}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            ))}
        </div>
      </div>
    </section>

    {/* ─── Confirmation form ──────────────────────────────────── */}
    <section className="bg-white py-20 sm:py-28">
      <div className="max-w-2xl mx-auto px-6 lg:px-8">
        <div className="text-center mb-10">
          <div className="inline-flex items-center bg-rose-50 text-rose-600 px-4 py-1.5 rounded-full mb-4">
            <Lock className="w-3 h-3 mr-1.5" />
            <span className="text-xs font-semibold uppercase tracking-[0.18em]">
              {t("deactivate.confirm.tag", {
                defaultValue: "Confirm deactivation",
              })}
            </span>
          </div>
          <h2 className="font-sans text-3xl sm:text-4xl text-gray-900 leading-[1.1] tracking-tight">
            {t("deactivate.confirm.title", {
              defaultValue: "Verify and confirm.",
            })}
          </h2>
          <p className="mt-3 text-gray-500">
            {t("deactivate.confirm.subtitle", {
              defaultValue:
                "Enter the phone number and password for the account you want to deactivate.",
            })}
          </p>
        </div>

        <Form
          method="post"
          className="bg-[#fff8f5] rounded-3xl p-7 sm:p-9 border border-rose-100"
        >
            {/* Reason picker (optional) */}
            <div className="mb-7">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                {t("deactivate.confirm.reasonLabel", {
                  defaultValue: "Why are you leaving?",
                })}{" "}
                <span className="font-normal text-gray-400">
                  ({t("deactivate.confirm.optional", { defaultValue: "optional" })})
                </span>
              </label>
              <div className="grid sm:grid-cols-2 gap-2">
                {reasons.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    className={`text-left text-sm px-4 py-3 rounded-xl border-2 transition-all ${reason === r.value
                      ? "border-rose-500 bg-white text-gray-900"
                      : "border-rose-100 bg-white hover:border-rose-200 text-gray-600"
                      }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
              <input type="hidden" name="reason" value={reason} />
            </div>

            {/* Account type toggle */}
            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-900 mb-3">
                {t("deactivate.confirm.accountType", {
                  defaultValue: "Account type",
                })}
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUserType("customer")}
                  className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 transition-all ${userType === "customer"
                    ? "border-rose-500 bg-white text-rose-600 font-semibold"
                    : "border-rose-100 bg-white text-gray-600 hover:border-rose-200"
                    }`}
                >
                  <Users className="w-4 h-4" />
                  {t("deactivate.confirm.customer", {
                    defaultValue: "Customer",
                  })}
                </button>
                <button
                  type="button"
                  onClick={() => setUserType("model")}
                  className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 transition-all ${userType === "model"
                    ? "border-rose-500 bg-white text-rose-600 font-semibold"
                    : "border-rose-100 bg-white text-gray-600 hover:border-rose-200"
                    }`}
                >
                  <Crown className="w-4 h-4" />
                  {t("deactivate.confirm.model", { defaultValue: "Companion" })}
                </button>
              </div>
              <input type="hidden" name="userType" value={userType} />
            </div>

            {/* Phone number */}
            <div className="mb-5">
              <label
                htmlFor="phone-input"
                className="block text-sm font-semibold text-gray-900 mb-2"
              >
                {t("deactivate.confirm.phoneLabel", {
                  defaultValue: "Phone number",
                })}
              </label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="phone-input"
                  name="phone"
                  type="tel"
                  inputMode="numeric"
                  autoComplete="tel"
                  required
                  placeholder="20XXXXXXXX"
                  className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-white border-2 border-rose-100 focus:border-rose-500 focus:outline-none text-sm tracking-wider transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="mb-7">
              <label
                htmlFor="password-input"
                className="block text-sm font-semibold text-gray-900 mb-2"
              >
                {t("deactivate.confirm.passwordLabel", {
                  defaultValue: "Password",
                })}
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  id="password-input"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full pl-10 pr-12 py-3.5 rounded-xl bg-white border-2 border-rose-100 focus:border-rose-500 focus:outline-none text-sm tracking-wider transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-rose-500 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Error banner */}
            {errorMessage && (
              <div className="mb-6 flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl px-4 py-3">
                <AlertTriangle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700">{errorMessage}</p>
              </div>
            )}

            {/* Action row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => navigate("/")}
                disabled={isSubmitting}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-white text-gray-900 border border-gray-200 hover:border-rose-300 hover:text-rose-500 transition-all disabled:opacity-50"
              >
                {t("deactivate.confirm.cancel", {
                  defaultValue: "Take me back",
                })}
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 py-3.5 rounded-xl text-sm font-semibold bg-rose-500 hover:bg-rose-600 text-white shadow-md shadow-rose-500/20 transition-all inline-flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {t("deactivate.confirm.submitting", {
                      defaultValue: "Deactivating…",
                    })}
                  </>
                ) : (
                  <>
                    {t("deactivate.confirm.submit", {
                      defaultValue: "Deactivate account",
                    })}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </div>
        </Form>
      </div>
    </section>

    {/* ─── Need help banner ────────────────────────────────────── */}
    <section className="bg-[#fffbf8] py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-6 lg:px-8">
        <div className="bg-white rounded-3xl p-8 sm:p-10 border border-rose-100 flex flex-col sm:flex-row gap-6 sm:items-center sm:justify-between">
          <div>
            <h3 className="font-serif text-2xl text-gray-900 leading-tight">
              {t("deactivate.help.title", {
                defaultValue: "Need help instead?",
              })}
            </h3>
            <p className="mt-2 text-sm text-gray-500">
              {t("deactivate.help.desc", {
                defaultValue:
                  "Reach out — we'll do our best to make things right before you leave.",
              })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a
              href="tel:+8562091082600"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 text-sm font-semibold transition-colors"
            >
              <Phone className="w-4 h-4" />
              {t("deactivate.help.call", { defaultValue: "Call" })}
            </a>
            <a
              href="mailto:xaosao95@gmail.com"
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full bg-rose-50 text-rose-600 hover:bg-rose-100 text-sm font-semibold transition-colors"
            >
              <Mail className="w-4 h-4" />
              {t("deactivate.help.email", { defaultValue: "Email" })}
            </a>
          </div>
        </div>
      </div>
      </section >

    <Footer />

    {/* Success modal — rendered above everything once deactivation
        completes. Closes only via the "Back to home" button. */}
    {succeeded && <SuccessModal onHome={() => navigate("/")} t={t} />}
    </div >
  );
}

/* ─── Helpers ─────────────────────────────────────────────────── */

function SuccessModal({
  onHome,
  t,
}: {
  onHome: () => void;
  t: (key: string, options?: { defaultValue?: string }) => string;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in"
    >
      <div className="relative bg-white rounded-3xl p-9 max-w-md w-full border-2 border-emerald-200 text-center shadow-2xl">
        <div className="mx-auto w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mb-5">
          <CheckCircle2 className="w-8 h-8 text-emerald-500" />
        </div>
        <h3 className="font-serif text-2xl text-gray-900 mb-2">
          {t("deactivate.success.title", {
            defaultValue: "Your account has been deactivated.",
          })}
      </h3>
      <p className="text-sm text-gray-500 max-w-md mx-auto leading-relaxed">
        {t("deactivate.success.desc", {
          defaultValue:
            "We're sorry to see you go. If you change your mind later, you'll need to sign up again from scratch.",
        })}
      </p>
        <button
          onClick={onHome}
          className="mt-7 inline-flex items-center gap-2 bg-rose-500 hover:bg-rose-600 text-white px-6 py-3 rounded-full text-sm font-semibold shadow-md shadow-rose-500/20"
        >
          {t("deactivate.success.home", { defaultValue: "Back to home" })}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

/**
 * Translates internal error codes into a friendlier fallback when
 * no i18n key matches. The action returns dotted keys
 * (`deactivate.errors.invalidCredentials`) so i18n is the primary
 * source; this is just a safety net.
 */
function humanizeError(code: string): string {
  switch (code) {
    case "deactivate.errors.missingFields":
      return "Please fill in all required fields.";
    case "deactivate.errors.invalidUserType":
      return "Please choose a valid account type.";
    case "deactivate.errors.invalidPhone":
      return "Please enter a valid phone number.";
    case "deactivate.errors.invalidCredentials":
      return "Phone number or password is incorrect.";
    default:
      return "Something went wrong. Please try again.";
  }
}

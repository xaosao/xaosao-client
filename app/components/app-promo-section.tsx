import { useTranslation } from "react-i18next";
import {
  Bell,
  MapPin,
  ShieldCheck,
  Download,
  Apple,
  Heart,
  MessageCircle,
  Search,
} from "lucide-react";

/**
 * App Promotion Section — editorial light variant.
 *
 * Two-column layout: refined phone mockup on the left (real chrome,
 * no decorative noise), copy + value-prop list + download CTAs on the
 * right. Background is cream so it contrasts softly with the rose
 * accents instead of fighting them.
 */
export function AppPromoSection() {
  const { t } = useTranslation();

  const valueProps = [
    {
      icon: Bell,
      title: t("home.appPromo.realtime.title", {
        defaultValue: "ການແຈ້ງເຕືອນແບບສົດໆ",
      }),
      desc: t("home.appPromo.realtime.desc", {
        defaultValue:
          "ຮັບການແຈ້ງເຕືອນທັນທີເມື່ອມີຂໍ້ຄວາມໃໝ່, ການຈອງ, ຫຼື ການອັບເດດສະຖານະ.",
      }),
    },
    {
      icon: MapPin,
      title: t("home.appPromo.nearby.title", {
        defaultValue: "ຄົ້ນຫາໃກ້ໆທ່ານ",
      }),
      desc: t("home.appPromo.nearby.desc", {
        defaultValue:
          "ຄົ້ນຫາສາວທີ່ໃກ້ໆທ່ານໃຊ້ GPS ແບບແມ່ນຍຳ — ສະດວກ, ປອດໄພ, ໄວ.",
      }),
    },
    {
      icon: ShieldCheck,
      title: t("home.appPromo.secure.title", {
        defaultValue: "ການຊຳລະທີ່ປອດໄພ",
      }),
      desc: t("home.appPromo.secure.desc", {
        defaultValue:
          "ການຊຳລະຜ່ານ wallet ໃນແອັບ — ມີການເຫັນຍອດ ແລະ ປະຫວັດທຸລະກຳຄົບຖ້ວນ.",
      }),
    },
  ];

  return (
    <section
      id="download"
      className="relative py-24 sm:py-32 bg-[#fff8f5] overflow-hidden scroll-mt-20"
    >
      {/* Soft brand wash in the corners */}
      <div className="absolute -top-32 -left-32 w-[28rem] h-[28rem] bg-rose-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-[28rem] h-[28rem] bg-amber-200/40 rounded-full blur-3xl pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-6 lg:px-8">
        <div className="grid lg:grid-cols-2 gap-16 lg:gap-24 items-center">
          {/* ── Left: phone mockup ─────────────────────────────────── */}
          <div className="flex justify-center lg:justify-start order-2 lg:order-1">
            <PhoneMockup />
          </div>

          {/* ── Right: copy ────────────────────────────────────────── */}
          <div className="order-1 lg:order-2 space-y-10">
            <div>
              <div className="inline-flex items-center gap-2 text-rose-500 mb-4">
                <div className="w-8 h-px bg-rose-500" />
                <span className="text-xs font-semibold uppercase tracking-[0.2em]">
                  {t("home.appPromo.tag", { defaultValue: "Mobile App" })}
                </span>
              </div>
              <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-gray-900 leading-[1.05] tracking-tight">
                {t("home.appPromo.title", {
                  defaultValue: "ດາວໂຫຼດແອັບ XaoSao ດຽວນີ້",
                })}
              </h2>
              <p className="mt-6 text-lg text-gray-600 leading-relaxed max-w-xl">
                {t("home.appPromo.subtitle", {
                  defaultValue:
                    "ປະສົບການເຕັມຮູບແບບ — ການຈັດການການຈອງ, ການແຊັດ, ການແຈ້ງເຕືອນ, ແລະ ກະເປົາເງິນທັງໝົດໃນແອັບດຽວ.",
                })}
              </p>
            </div>

            <div className="space-y-5">
              {valueProps.map((vp) => (
                <div key={vp.title} className="flex items-start gap-4">
                  <div className="flex-shrink-0 w-11 h-11 rounded-full bg-white shadow-md flex items-center justify-center ring-1 ring-gray-100">
                    <vp.icon className="w-5 h-5 text-rose-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-gray-900 mb-1">
                      {vp.title}
                    </h3>
                    <p className="text-sm text-gray-600 leading-relaxed">
                      {vp.desc}
                    </p>
                  </div>
                </div>
              ))}
            </div>

            {/* Download buttons */}
            <div className="flex flex-wrap gap-3 pt-2">
              <a
                href="#"
                aria-label="Google Play"
                className="group flex items-center gap-3 bg-gray-900 hover:bg-black text-white px-5 py-3.5 rounded-2xl shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg"
              >
                <svg viewBox="0 0 24 24" className="w-7 h-7" fill="currentColor">
                  <path d="M3.609 1.814 13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893 2.302 2.302-10.937 6.333 8.635-8.635zm3.171-4.235 2.853 1.653a1 1 0 0 1 0 1.75l-2.853 1.653-2.498-2.498 2.498-2.558zM5.864 2.658 16.802 8.99l-2.302 2.302L5.864 2.658z" />
                </svg>
                <div className="text-left leading-tight">
                  <div className="text-[10px] uppercase tracking-wider opacity-70">
                    {t("home.appPromo.googlePlayPrefix", {
                      defaultValue: "GET IT ON",
                    })}
                  </div>
                  <div className="text-sm font-semibold">Google Play</div>
                </div>
              </a>

              <a
                href="#"
                aria-label="App Store"
                className="group flex items-center gap-3 bg-gray-900 hover:bg-black text-white px-5 py-3.5 rounded-2xl shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg"
              >
                <Apple className="w-7 h-7" />
                <div className="text-left leading-tight">
                  <div className="text-[10px] uppercase tracking-wider opacity-70">
                    {t("home.appPromo.appStorePrefix", {
                      defaultValue: "Download on the",
                    })}
                  </div>
                  <div className="text-sm font-semibold">App Store</div>
                </div>
              </a>

              <a
                href="/downloads/xaosao.apk"
                aria-label="Direct APK"
                className="group flex items-center gap-3 bg-white hover:bg-gray-50 text-gray-900 px-5 py-3.5 rounded-2xl shadow-sm transition-all hover:scale-[1.02] hover:shadow-lg ring-1 ring-gray-200"
              >
                <Download className="w-7 h-7 text-rose-500" />
                <div className="text-left leading-tight">
                  <div className="text-[10px] uppercase tracking-wider opacity-60">
                    {t("home.appPromo.apkPrefix", {
                      defaultValue: "Android",
                    })}
                  </div>
                  <div className="text-sm font-semibold">
                    {t("home.appPromo.apkLabel", { defaultValue: "Direct APK" })}
                  </div>
                </div>
              </a>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ─── Refined phone mockup ────────────────────────────────────────────
 *
 * Cleaner geometry than before: thinner bezels, rounded screen, subtle
 * shadow stack. Shows search bar + featured profile + chat preview
 * to mirror the actual XaoSao UI shape.
 */
function PhoneMockup() {
  return (
    <div className="relative">
      {/* Floating chips */}
      <div className="absolute -top-4 -left-2 sm:-left-10 z-20 bg-white rounded-full shadow-xl py-2 pl-2 pr-4 flex items-center gap-2 animate-bounce-slow">
        <div className="w-8 h-8 rounded-full bg-rose-500 flex items-center justify-center">
          <Heart className="w-4 h-4 text-white fill-white" />
        </div>
        <div className="text-xs font-semibold text-gray-900">New match!</div>
      </div>

      <div className="absolute -bottom-4 right-0 sm:-right-8 z-20 bg-white rounded-full shadow-xl py-2 pl-2 pr-4 flex items-center gap-2 animate-bounce-slow-delay">
        <div className="w-8 h-8 rounded-full bg-amber-400 flex items-center justify-center text-xs">
          ⭐
        </div>
        <div className="text-xs font-semibold text-gray-900">4.9 · 12k+</div>
      </div>

      {/* Device */}
      <div className="relative w-[290px] sm:w-[330px] h-[600px] sm:h-[660px] bg-gray-900 rounded-[3rem] p-3 shadow-2xl ring-1 ring-gray-800">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-28 h-6 bg-gray-900 rounded-b-2xl z-10" />

        <div className="w-full h-full bg-[#fff8f5] rounded-[2.4rem] overflow-hidden">
          {/* Status row */}
          <div className="px-6 pt-3 pb-1 flex items-center justify-between text-[10px] text-gray-700 font-semibold">
            <span>9:41</span>
            <span>●●● ▮</span>
          </div>

          {/* Page header */}
          <div className="px-5 pt-3">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-[10px] text-gray-400 uppercase tracking-wider">
                  Discover
                </div>
                <div className="font-serif text-2xl text-gray-900 leading-tight">
                  Sao near you
                </div>
              </div>
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-rose-400 to-pink-500 ring-2 ring-white" />
            </div>

            {/* Search */}
            <div className="mt-4 flex items-center gap-2 bg-white rounded-2xl px-3 py-2.5 shadow-sm ring-1 ring-gray-100">
              <Search className="w-4 h-4 text-gray-400" />
              <span className="text-xs text-gray-400">Search by name…</span>
            </div>

            {/* Online dots strip */}
            <div className="mt-4 flex gap-2.5 overflow-hidden">
              {[
                "from-rose-300 to-pink-500",
                "from-violet-300 to-purple-500",
                "from-amber-300 to-orange-500",
                "from-emerald-300 to-teal-500",
                "from-sky-300 to-blue-500",
              ].map((g, i) => (
                <div key={i} className="relative">
                  <div
                    className={`w-11 h-11 rounded-2xl bg-gradient-to-br ${g} shadow-sm`}
                  />
                  <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>
              ))}
            </div>
          </div>

          {/* Featured profile card */}
          <div className="mx-5 mt-5 rounded-3xl overflow-hidden shadow-md ring-1 ring-gray-100 relative h-44">
            <div className="absolute inset-0 bg-gradient-to-br from-rose-200 via-pink-300 to-fuchsia-400" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <div className="relative h-full p-4 flex flex-col justify-between">
              <div className="self-start bg-white/90 backdrop-blur-sm rounded-full px-2 py-1 text-[10px] font-semibold text-rose-600">
                ★ Top rated
              </div>
              <div className="text-white">
                <div className="font-serif text-xl leading-tight">
                  Sao ນ້ອຍ
                </div>
                <div className="flex items-center gap-1.5 text-[11px] opacity-90">
                  <MapPin className="w-3 h-3" />
                  Vientiane · 1.2 km
                </div>
              </div>
            </div>
          </div>

          {/* Chat preview */}
          <div className="mx-5 mt-4 space-y-2">
            {[
              {
                name: "Maly",
                msg: "ມື້ນີ້ສະບາຍດີຄະ ❤️",
                grad: "from-violet-300 to-purple-500",
                online: true,
              },
              {
                name: "Daophet",
                msg: "ຍິນດີຮັບການຈອງ",
                grad: "from-amber-300 to-orange-500",
                online: false,
              },
            ].map((c) => (
              <div
                key={c.name}
                className="flex items-center gap-3 bg-white rounded-2xl px-3 py-2.5 shadow-sm ring-1 ring-gray-100"
              >
                <div className="relative">
                  <div
                    className={`w-9 h-9 rounded-full bg-gradient-to-br ${c.grad}`}
                  />
                  {c.online && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-gray-900">
                    {c.name}
                  </div>
                  <div className="text-[11px] text-gray-500 truncate">
                    {c.msg}
                  </div>
                </div>
                <MessageCircle className="w-4 h-4 text-rose-500" />
              </div>
            ))}
          </div>
        </div>

        {/* Side buttons */}
        <div className="absolute left-[-3px] top-28 w-1 h-12 bg-gray-700 rounded-l-full" />
        <div className="absolute right-[-3px] top-36 w-1 h-16 bg-gray-700 rounded-r-full" />
      </div>

      <div className="absolute inset-0 -z-10 bg-gradient-to-br from-rose-200/50 to-amber-200/50 blur-3xl scale-110" />
    </div>
  );
}

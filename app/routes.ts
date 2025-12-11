import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // API routes for SSE notifications
  route(
    "api/notifications/model-sse",
    "./routes/api/notifications/model-sse.ts"
  ),
  route(
    "api/notifications/customer-sse",
    "./routes/api/notifications/customer-sse.ts"
  ),
  route(
    "api/notifications/mark-read",
    "./routes/api/notifications/mark-read.ts"
  ),

  // authentication routes
  route("login", "./routes/auth/login.tsx"),
  route("register", "./routes/auth/register.tsx"),
  route("forgot-password", "./routes/auth/forgot-password.tsx"),
  route("reset-password", "./routes/auth/reset-password.tsx"),
  route("verify-otp", "./routes/auth/verify-otp.tsx"),
  route("logout", "./routes/logout.ts"),
  route("model-logout", "./routes/model-logout.ts"),

  // Model authentication routes
  route("model-auth/login", "./routes/model-auth/login.tsx"),
  route("model-auth/register", "./routes/model-auth/register.tsx"),
  route(
    "model-auth/forgot-password",
    "./routes/model-auth/forgot-password.tsx"
  ),
  route("model-auth/verify-otp", "./routes/model-auth/verify-otp.tsx"),
  route("model-auth/reset-password", "./routes/model-auth/reset-password.tsx"),

  // Model dashboard routes
  route("model", "./routes/model/layout.tsx", [
    index("./routes/model/dashboard.tsx"),
    route("matches", "./routes/model/matches/matches.tsx"),
    route("profile", "./routes/model/profile/profile.tsx"),
    route("profile/edit", "./routes/model/profile/edit.tsx"),
    route(
      "customer-profile/:id",
      "./routes/model/customer-profile/profile.tsx"
    ),
    route(
      "customer-profile-share/:id",
      "./routes/model/customer-profile/profile.share.tsx"
    ),

    // Dating routes with nested modals
    route("dating", "./routes/model/dating/dating.tsx", [
      route("detail/:id", "./routes/model/dating/dating.detail.tsx"),
      route("accept/:id", "./routes/model/dating/dating.accept.tsx"),
      route("reject/:id", "./routes/model/dating/dating.reject.tsx"),
      route("complete/:id", "./routes/model/dating/dating.complete.tsx"),
      route("delete/:id", "./routes/model/dating/dating.delete.tsx"),
      route("checkin/:id", "./routes/model/dating/dating.checkin.tsx"),
    ]),

    // Settings with nested routes
    route("settings", "./routes/model/settings.tsx", [
      route("services", "./routes/model/settings/services.tsx"),
      route("wallet", "./routes/model/settings/wallet.tsx", [
        route(
          "detail/:transactionId",
          "./routes/model/settings/wallet/detail.$transactionId.tsx"
        ),
        route(
          "edit/:transactionId",
          "./routes/model/settings/wallet/edit.$transactionId.tsx"
        ),
        route(
          "delete/:transactionId",
          "./routes/model/settings/wallet/delete.$transactionId.tsx"
        ),
      ]),
      route("password", "./routes/model/settings/password.tsx"),
      route("report", "./routes/model/settings/report.tsx"),
      route("delete-account", "./routes/model/settings/delete-account.tsx"),
    ]),

    // your new chat route
    route("realtime-chat", "./routes/model/chat/chat-wrapper.tsx"),
    route("chat", "./routes/model/chat/single-chat-wrapper.tsx"),

    // Notifications
    route("notifications", "./routes/model/notifications/notifications.tsx"),
  ]),

  route("customer", "./routes/customer/layout.tsx", [
    index("./routes/customer/discover.tsx"),
    route("matches", "./routes/customer/matches/matches.tsx"),

    route("dates-history", "./routes/customer/booking-history/booking.tsx"),

    // your new chat route
    route("realtime-chat", "./routes/customer/chat/chat-wrapper.tsx"),
    route("chat", "./routes/customer/chat/single-chat-wrapper.tsx"),

    // profile
    route("profile", "./routes/customer/profile/profile.tsx"),
    route("profile-edit/:userId", "./routes/customer/profile/profile.edit.tsx"),
    route(
      "profile-share/:userId",
      "./routes/customer/profile/profile.share.tsx"
    ),

    // user profile:
    route(
      "user-profile/:userId",
      "./routes/customer/model-profile/profile.tsx"
    ),
    route(
      "user-profile-share/:userId",
      "./routes/customer/model-profile/profile.share.tsx"
    ),

    // booking
    route(
      "book-service/:modelId/:serviceId",
      "./routes/customer/model-profile/profile.book.tsx"
    ),
    route(
      "book-service/delete/:id",
      "./routes/customer/booking-history/booking.delete.tsx"
    ),
    route(
      "book-service/edit/:id",
      "./routes/customer/booking-history/booking.edit.tsx"
    ),
    route(
      "book-service/detail/:id",
      "./routes/customer/booking-history/booking.detail.tsx"
    ),
    route(
      "book-service/cancel/:id",
      "./routes/customer/booking-history/booking.cancel.tsx"
    ),
    route(
      "book-service/checkin/:id",
      "./routes/customer/booking-history/booking.checkin.tsx"
    ),
    route(
      "book-service/dispute/:id",
      "./routes/customer/booking-history/booking.dispute.tsx"
    ),
    route(
      "confirm-booking/:token",
      "./routes/customer/booking-history/booking.confirm-qr.tsx"
    ),

    // setting
    route("setting", "./routes/customer/setting/setting.tsx"),
    route(
      "setting-detail/:tab",
      "./routes/customer/setting/setting-detail.tsx"
    ),

    // wallets
    route("wallets", "./routes/customer/wallet/wallet.tsx"),
    route(
      "wallets/delete/:transactionId",
      "./routes/customer/wallet/wallet.delete.tsx"
    ),
    route(
      "wallets/edit/:transactionId",
      "./routes/customer/wallet/wallet.edit.tsx"
    ),
    route(
      "wallets/detail/:transactionId",
      "./routes/customer/wallet/wallet.detail.tsx"
    ),
    route("wallet-topup", "./routes/customer/wallet/wallet.topup.tsx"),

    // Packages:
    route("packages", "./routes/customer/packages/package.tsx"),
    route("payment/:id", "./routes/customer/packages/payment.tsx"),
    route("subscription-history", "./routes/customer/packages/history.tsx"),

    // Notifications
    route("notifications", "./routes/customer/notifications/notifications.tsx"),
  ]),
] satisfies RouteConfig;

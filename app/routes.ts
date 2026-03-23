import { index, route, type RouteConfig } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),

  // Public post share page (SEO/OG tags for social media)
  route("post/:id", "./routes/post-share.tsx"),

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
  route(
    "api/notifications/update-settings",
    "./routes/api/notifications/update-settings.ts"
  ),

  // API routes for Push notifications
  route("api/push/subscribe", "./routes/api/push/subscribe.ts"),
  route("api/push/unsubscribe", "./routes/api/push/unsubscribe.ts"),

  // API routes for Subscription SSE
  route("api/subscription-events", "./routes/api/subscription-events.ts"),
  route("api/trigger-subscription-event", "./routes/api/trigger-subscription-event.ts"),
  route("api/trigger-notification", "./routes/api/trigger-notification.ts"),

  // API route for Location
  route("api/location/update", "./routes/api/location/update.ts"),

  // API routes for Call service
  route("api/call/initiate", "./routes/api/call/initiate.ts"),
  route("api/call/accept", "./routes/api/call/accept.ts"),
  route("api/call/decline", "./routes/api/call/decline.ts"),
  route("api/call/start", "./routes/api/call/start.ts"),
  route("api/call/end", "./routes/api/call/end.ts"),
  route("api/call/missed", "./routes/api/call/missed.ts"),
  route("api/call/heartbeat", "./routes/api/call/heartbeat.ts"),
  route("api/call/booking", "./routes/api/call/booking.ts"),
  route("api/call/register-peer", "./routes/api/call/register-peer.ts"),

  // authentication routes
  route("video-tutorials", "./routes/video-tutorials.tsx"),
  route("login", "./routes/auth/login.tsx"),
  route("register", "./routes/auth/register.tsx"),
  route("forgot-password", "./routes/auth/forgot-password.tsx"),
  route("reset-password", "./routes/auth/reset-password.tsx"),
  route("verify-otp", "./routes/auth/verify-otp.tsx"),
  route("logout", "./routes/logout.ts"),
  route("model-logout", "./routes/model-logout.ts"),
  route("clear-session", "./routes/auth/clear-session.ts"),

  // Model authentication routes
  route("model-auth/login", "./routes/model-auth/login.tsx"),
  route("model-auth/register", "./routes/model-auth/register.tsx"),
  route(
    "model-auth/forgot-password",
    "./routes/model-auth/forgot-password.tsx"
  ),
  route("model-auth/verify-otp", "./routes/model-auth/verify-otp.tsx"),
  route("model-auth/verify-registration", "./routes/model-auth/verify-registration.tsx"),
  route("model-auth/reset-password", "./routes/model-auth/reset-password.tsx"),

  // Model dashboard routes
  route("model", "./routes/model/layout.tsx", [
    index("./routes/model/posts/posts.tsx"),
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
      route("delete/:id", "./routes/model/dating/dating.delete.tsx"),
      route("receive-money/:id", "./routes/model/dating/dating.receive-money.tsx"),
      route("refund/:id", "./routes/model/dating/dating.refund.tsx"),
    ]),

    // Posts
    route("posts/create", "./routes/model/posts/posts.create.tsx"),
    route("posts/load-more", "./routes/model/posts/posts.load-more.tsx"),
    route("posts/:id", "./routes/model/posts/posts.$id.tsx"),
    route("posts/:id/interested", "./routes/model/posts/posts.$id.interested.tsx"),
    route("posts/:id/delete", "./routes/model/posts/posts.$id.delete.tsx"),
    route("posts/:id/fulfill", "./routes/model/posts/posts.$id.fulfill.tsx"),
    route("posts/:id/comment", "./routes/model/posts/posts.$id.comment.tsx"),

    // Referral program
    route("referral", "./routes/model/referral.tsx"),

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
      route("notifications", "./routes/model/settings/notifications.tsx"),
      route("profile-visibility", "./routes/model/settings/profile-visibility.tsx"),
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
    route("discover/search", "./routes/customer/discover.search.tsx"),
    route("discover/load-more", "./routes/customer/discover.load-more.tsx"),
    route("matches", "./routes/customer/matches/matches.tsx"),
    route("matches/search", "./routes/customer/matches.search.tsx"),

    // Posts
    route("posts", "./routes/customer/posts/posts.tsx"),
    route("posts/create", "./routes/customer/posts/posts.create.tsx"),
    route("posts/load-more", "./routes/customer/posts/posts.load-more.tsx"),
    route("posts/:id", "./routes/customer/posts/posts.$id.tsx"),
    route("posts/:id/interested", "./routes/customer/posts/posts.$id.interested.tsx"),
    route("posts/:id/delete", "./routes/customer/posts/posts.$id.delete.tsx"),
    route("posts/:id/fulfill", "./routes/customer/posts/posts.$id.fulfill.tsx"),
    route("posts/:id/gift", "./routes/customer/posts/posts.$id.gift.tsx"),
    route("posts/:id/comment", "./routes/customer/posts/posts.$id.comment.tsx"),

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
      "book-service/dispute/:id",
      "./routes/customer/booking-history/booking.dispute.tsx"
    ),
    route(
      "book-service/release/:id",
      "./routes/customer/booking-history/booking.release.tsx"
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
    route("subscribe-trial", "./routes/customer/subscribe-trial.ts"),
    route("check-booking", "./routes/customer/check-booking.ts"),

    // Notifications
    route("notifications", "./routes/customer/notifications/notifications.tsx"),

    // Call service routes
    route("call/start/:bookingId", "./routes/customer/call/call.waiting.tsx"),
    route("call/active/:bookingId", "./routes/customer/call/call.active.tsx"),
    route("call/summary/:bookingId", "./routes/customer/call/call.summary.tsx"),
  ]),

  // Model call routes (outside nested routes for simplicity)
  route("model/call/join/:bookingId", "./routes/model/call/call.incoming.tsx"),
  route("model/call/active/:bookingId", "./routes/model/call/call.active.tsx"),
  route("model/call/summary/:bookingId", "./routes/model/call/call.summary.tsx"),
] satisfies RouteConfig;

import Telbiz from "telbiz";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { default as bcrypt } from "bcryptjs";

import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { UserStatus } from "~/interfaces/base";
import { createWallet } from "./wallet.server";
import { notifyAdminNewCustomer } from "./email.server";
import {
  notifyCustomerWelcome,
  notifyReferralRegistered,
} from "./unified-notification.server";
import type {
  ICustomerSigninCredentials,
  ICustomerSignupCredentials,
  TelbizError,
  TelbizResponse,
} from "~/interfaces";
import {
  createCookie,
  createCookieSessionStorage,
  redirect,
} from "react-router";
import { FieldValidationError, getLocationDetails } from "./base.server";

const { compare, hash } = bcrypt;
const SESSION_SECRET = process.env.SESSION_SECRET!;

type TelbizResult = {
  success: boolean;
  data?: TelbizResponse;
  error?: TelbizError;
};

// User Registration Types
interface UserRegistrationData {
  user_id: string;
  country_code: string;
  phone_number: string;
  country: string;
  country_full_name: string;
  first_name: string;
  last_name: string;
  user_name: string;
  gender: "male" | "female" | "other";
  profile_image?: string;
  user_type: "customer" | "model";
}

interface UserLogin {
  phone_number: string;
  user_type: "customer" | "model";
}

interface LoginSuccessResponse {
  message: string;
  success: true;
  token: string;
}

interface LoginErrorResponse {
  success: false;
  error: string;
  message: string;
}

interface RegistrationSuccessResponse {
  success: true;
  data: any;
  message: string;
}

interface RegistrationErrorResponse {
  success: false;
  error: string;
  message: string;
}

type RegistrationResponse =
  | RegistrationSuccessResponse
  | RegistrationErrorResponse;

type LoginResponse = LoginSuccessResponse | LoginErrorResponse;

const tb = new Telbiz(
  process.env.TELBIZ_CLIENT_ID as string,
  process.env.TELBIZ_SECRETKEY as string
);

export const sessionStorage = createCookieSessionStorage({
  cookie: {
    // secure: process.env.NODE_ENV === "production",
    secure: false,
    secrets: [SESSION_SECRET],
    sameSite: "lax",
    httpOnly: true,
  },
});

export async function getUserFromSession(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const customerId = session.get("customerId");

  if (!customerId) {
    return null;
  }

  return customerId;
}

export async function requireUserSession(request: Request) {
  const customerId = await getUserFromSession(request);

  if (!customerId) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const publicPaths = ["/signin", "/signup", "/forgot-password"];
    const isPublic = publicPaths.includes(pathname);

    if (!isPublic) {
      throw redirect("/login");
    }
  }

  return customerId;
}

/**
 * Require user session AND phone verification.
 * Use this for protected routes that require verified users.
 * Redirects to /verify-otp if user is logged in but not verified.
 */
export async function requireVerifiedUserSession(request: Request) {
  const customerId = await getUserFromSession(request);

  if (!customerId) {
    throw redirect("/login");
  }

  // Check if phone is verified
  const isVerified = await isCustomerPhoneVerified(customerId);

  if (!isVerified) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // Don't redirect if already on verify-otp page (avoid infinite loop)
    if (pathname !== "/verify-otp") {
      throw redirect("/verify-otp");
    }
  }

  return customerId;
}

// Get token from session:
export async function getUserTokenFromSession(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const token = session.get("token");

  if (!token) {
    return null;
  }

  return token;
}

export async function destroyUserSession(request: Request) {
  const session = await sessionStorage.getSession(
    request.headers.get("Cookie")
  );

  const isProduction = process.env.NODE_ENV === "production";

  // Build cookie clearing headers that match the creation attributes
  const customerCookieParts = [
    `whoxa_customer_auth_token=`,
    `Path=/`,
    `Max-Age=0`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ];

  const modelCookieParts = [
    `whoxa_model_auth_token=`,
    `Path=/`,
    `Max-Age=0`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ];

  if (isProduction) {
    customerCookieParts.push(`Domain=.xaosao.com`);
    customerCookieParts.push(`Secure`);
    modelCookieParts.push(`Domain=.xaosao.com`);
    modelCookieParts.push(`Secure`);
  }

  const headers = new Headers();
  headers.append("Set-Cookie", await sessionStorage.destroySession(session));
  headers.append("Set-Cookie", customerCookieParts.join("; "));
  headers.append("Set-Cookie", modelCookieParts.join("; "));

  return redirect("/", { headers });
}

export async function createUserSession(
  token: string,
  customerId: string,
  rememberMe: boolean,
  redirectPath: string
) {
  const isProduction = process.env.NODE_ENV === "production";
  // Session expiration: 24 hours default, 14 days with "Remember Me"
  const maxAge = rememberMe ? 14 * 24 * 60 * 60 : 1 * 24 * 60 * 60;

  // Create session
  const session = await sessionStorage.getSession();
  session.set("customerId", customerId);
  session.set("token", token);

  // Build cookie header manually to avoid encoding
  const cookieParts = [
    `whoxa_customer_auth_token=${token}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `SameSite=Lax`,
  ];

  if (isProduction) {
    cookieParts.push(`Domain=.xaosao.com`);
    cookieParts.push(`Secure`);
  }

  const authCookieHeader = cookieParts.join("; ");
  const sessionHeader = await sessionStorage.commitSession(session, { maxAge });

  const headers = new Headers();
  headers.append("Set-Cookie", authCookieHeader);
  headers.append("Set-Cookie", sessionHeader);

  return redirect(redirectPath, { headers });
}

// This for register new user to chat DB:
async function loginOnChat(userData: UserLogin): Promise<LoginResponse> {
  const url = `${process.env.VITE_API_URL}login-with-phone`;
  const bypassChatServer = process.env.BYPASS_CHAT_SERVER === "true";

  // If chat server is bypassed via env variable, return fallback token
  if (bypassChatServer) {
    console.warn("Chat server bypassed via BYPASS_CHAT_SERVER env variable.");
    return {
      token: `bypass-token-${userData.phone_number}-${Date.now()}`,
      success: true,
      message: "Chat server bypassed",
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });
    // Log status and URL for debugging
    console.log("loginOnChat URL:", url, "Status:", response.status);

    // Check if response is JSON (chat server running) or HTML (chat server not running)
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // Chat server is not running, use development fallback
      if (process.env.NODE_ENV === "development") {
        console.warn("Chat server not running. Using development fallback token.");
        return {
          token: `dev-token-${userData.phone_number}-${Date.now()}`,
          success: true,
          message: "Development mode: Chat server bypassed",
        };
      }
      throw new Error("Chat server is not available");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return {
      token: data.token,
      success: data.success,
      message: data.message,
    };
  } catch (error) {
    console.error("Registration from RRV7 to React failed 11:", error);

    // Development fallback when chat server is unavailable
    if (process.env.NODE_ENV === "development") {
      console.warn("Chat server error. Using development fallback token.");
      return {
        token: `dev-token-${userData.phone_number}-${Date.now()}`,
        success: true,
        message: "Development mode: Chat server bypassed",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to login user",
    };
  }
}

export async function customerLogin({
  whatsapp,
  rememberMe,
  password,
}: ICustomerSigninCredentials, redirectPath: string = "/customer") {
  const existingUser = await prisma.customer.findFirst({
    where: { whatsapp },
  });

  const auditBase = {
    action: "LOGIN",
    customer: existingUser?.id,
  };

  if (!existingUser) {
    const error = new Error(
      "login.errors.invalidCredentials"
    ) as Error & {
      status?: number;
    };
    error.status = 401;

    await createAuditLogs({
      ...auditBase,
      description: `Login failed, not user founded`,
      status: "failed",
      onError: error,
    });

    throw error;
  }

  if (existingUser.status !== "active") {
    const error = new Error(
      "login.errors.accountUnavailable"
    ) as Error & {
      status?: number;
    };
    error.status = 401;

    await createAuditLogs({
      ...auditBase,
      description: `Login failed, User is not active!`,
      status: "failed",
      onError: error,
    });

    throw error;
  }

  const passwordCorrect = await compare(password, existingUser.password);
  if (!passwordCorrect) {
    const error = new Error(
      "login.errors.invalidCredentials"
    ) as Error & {
      status?: number;
    };
    error.status = 401;

    await createAuditLogs({
      ...auditBase,
      description: `Login failed, password incorrect!`,
      status: "failed",
      onError: error,
    });
    throw error;
  }

  await createAuditLogs({
    ...auditBase,
    description: `Login with: ${whatsapp}, ${password},successfully.`,
    status: "success",
    onSuccess: existingUser,
  });

  const userData: UserLogin = {
    phone_number: String(whatsapp),
    user_type: "customer",
  };

  const chatLogin = await loginOnChat(userData);

  // console.log("Chat login DATA::", chatLogin);

  if (chatLogin.success) {
    // console.log("Chat login token:::", chatLogin.token);

    // Check if customer's phone is verified
    // If not verified, send OTP and redirect to verification page
    if (!existingUser.isPhoneVerified) {
      try {
        await sendVerificationOTP(existingUser.id);
      } catch (otpError) {
        console.error("SEND_VERIFICATION_OTP_ON_LOGIN_FAILED", otpError);
        // Don't fail login if OTP sending fails - they can resend later
      }

      // Redirect to OTP verification instead of customer dashboard
      return createUserSession(
        chatLogin.token,
        existingUser.id,
        rememberMe,
        "/verify-otp"
      );
    }

    // Phone is verified, proceed to requested page
    return createUserSession(
      chatLogin.token,
      existingUser.id,
      rememberMe,
      redirectPath
    );
  } else {
    // If MySQL login fails, log the error
    const error = new Error(
      `Failed to login to chat system: ${chatLogin.message || chatLogin.error}`
    ) as Error & {
      status?: number;
    };
    error.status = 500;

    await createAuditLogs({
      ...auditBase,
      description: `MySQL login failed for customer ${existingUser.id}. Error: ${chatLogin.message}`,
      status: "failed",
      onError: chatLogin.error,
    });

    throw error;
  }
}

// This for register new user to chat DB:
async function registerUserWithoutOTP(
  userData: UserRegistrationData
): Promise<RegistrationResponse> {
  const url = `${process.env.VITE_API_URL}register-without-otp`;
  const bypassChatServer = process.env.BYPASS_CHAT_SERVER === "true";

  // If chat server is bypassed via env variable, return success
  if (bypassChatServer) {
    console.warn("Chat server registration bypassed via BYPASS_CHAT_SERVER env variable.");
    return {
      success: true,
      data: { user_id: userData.user_id },
      message: "Chat server bypassed",
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

    // Check if response is JSON (chat server running) or HTML (chat server not running)
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // Chat server is not running, use development fallback
      if (process.env.NODE_ENV === "development") {
        console.warn("Chat server not running. Using development fallback for registration.");
        return {
          success: true,
          data: { user_id: userData.user_id },
          message: "Development mode: Chat server bypassed",
        };
      }
      throw new Error("Chat server is not available");
    }

    const data: RegistrationResponse = await response.json();

    // Check if the request was successful
    if (!data.success) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return {
      success: true,
      data: data,
      message: "User registered successfully",
    };
  } catch (error) {
    console.error("Registration from RRV7 to React failed11:", error);

    // Development fallback when chat server is unavailable
    if (process.env.NODE_ENV === "development") {
      console.warn("Chat server error. Using development fallback for registration.");
      return {
        success: true,
        data: { user_id: userData.user_id },
        message: "Development mode: Chat server bypassed",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "Failed to register user",
    };
  }
}

// Register new user for Xaosao:
export async function customerRegister(
  customerData: ICustomerSignupCredentials,
  ip: string,
  accessKey: string
) {
  if (!customerData) throw new Error("Missing creation data!");

  try {
    const existingCustomer = await prisma.customer.findFirst({
      where: { whatsapp: customerData.whatsapp },
    });

    if (existingCustomer) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "This phone number is already registered!",
        messageKey: "register.errors.phoneAlreadyRegistered",
      });
    }

    const locationDetails = await getLocationDetails(ip, accessKey);
    const passwordHash = await hash(customerData.password, 12);

    // console.log("Location Details::::", locationDetails);

    // Get latest number and calculate next
    const latestUser = await prisma.customer.findFirst({
      where: {
        number: {
          startsWith: "XSC-",
        },
      },
      orderBy: {
        number: "desc",
      },
    });

    let nextNumber = "XSC-0001";
    if (latestUser?.number) {
      const latestNumber = parseInt(latestUser.number.replace("XSC-", ""));
      const incremented = (latestNumber + 1).toString().padStart(4, "0");
      nextNumber = `XSC-${incremented}`;
    }

    const customer = await prisma.customer.create({
      data: {
        number: nextNumber,
        firstName: customerData.firstName,
        lastName: customerData.lastName,
        dob: new Date(customerData.dob),
        gender: customerData.gender,
        password: passwordHash,
        profile: customerData.profile || "",
        latitude: +locationDetails.latitude,
        longitude: +locationDetails.longitude,
        country: locationDetails.countryName,
        status: UserStatus.ACTIVE,
        ip: ip,
        whatsapp: customerData.whatsapp,
        location: locationDetails,
        resetToken: randomUUID(),
        resetTokenVerified: false,
        resetTokenExpiry: null,
        twofactorOTP: randomUUID(),
        // Referral tracking - store which model referred this customer
        referredByModelId: customerData.referredByModelId || null,
      },
    });

    // If customer was referred by a model, increment the model's totalReferredCustomers
    if (customerData.referredByModelId) {
      try {
        await prisma.model.update({
          where: { id: customerData.referredByModelId },
          data: {
            totalReferredCustomers: { increment: 1 },
          },
        });
        console.log(`Incremented totalReferredCustomers for model ${customerData.referredByModelId}`);

        // Notify referrer model about new customer registration
        await notifyReferralRegistered(
          customerData.referredByModelId,
          customer.firstName,
          "customer"
        );
      } catch (refError) {
        // Don't fail registration if referral count update fails
        console.error("Failed to update referrer's customer count:", refError);
      }
    }

    console.log("Customer:", customer);

    const auditBase = {
      action: "CUSTOMER_REGISTER",
      customer: customer.id,
    };

    if (customer.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create customer: ${customer.id} successfully!`,
        status: "success",
        onError: customer,
      });

      await createWallet(
        {
          totalBalance: 0,
          totalRecharge: 0,
          totalDeposit: 0,
          status: UserStatus.ACTIVE,
          customer: customer.id,
        },
        customer.id
      );

      // Auto-generate username for chat system from whatsapp number
      const generatedUsername = `customer_${customerData.whatsapp}`;

      const userData: UserRegistrationData = {
        user_id: customer.id,
        country_code: locationDetails.countryCode,
        phone_number: String(customerData.whatsapp),
        country: locationDetails.countryCode,
        country_full_name: locationDetails.countryName,
        first_name: customerData.firstName,
        last_name: customerData.lastName || "",
        user_name: generatedUsername,
        gender: customerData.gender,
        profile_image: customerData.profile || "",
        user_type: "customer",
      };

      const chatRes = await registerUserWithoutOTP(userData);

      // If MySQL registration fails, rollback MongoDB data
      if (!chatRes.success) {
        // Delete wallet first (due to foreign key constraint)
        await prisma.wallet.deleteMany({
          where: { customerId: customer.id },
        });

        // Delete customer from MongoDB
        await prisma.customer.delete({
          where: { id: customer.id },
        });

        await createAuditLogs({
          action: "CUSTOMER_REGISTER",
          customer: customer.id,
          description: `MySQL registration failed for customer ${customer.id}. Rolled back MongoDB data. Error: ${chatRes.message}`,
          status: "failed",
          onError: chatRes.error,
        });

        throw new Error(
          `Failed to register user in chat system: ${chatRes.message || chatRes.error}`
        );
      }
    }

    // Notify admin about new customer registration
    try {
      await notifyAdminNewCustomer({
        id: customer.id,
        firstName: customer.firstName,
        lastName: customer.lastName,
        gender: customer.gender,
      });
    } catch (notifyError) {
      console.error("NOTIFY_ADMIN_NEW_CUSTOMER_FAILED", notifyError);
    }

    // Send welcome notification to new customer (SMS, Push, In-App)
    try {
      await notifyCustomerWelcome(customer.id, customer.firstName);
    } catch (welcomeError) {
      console.error("WELCOME_NOTIFICATION_FAILED", welcomeError);
    }

    // Auto-login: Log the customer into the chat system
    const userData: UserLogin = {
      phone_number: String(customerData.whatsapp),
      user_type: "customer",
    };

    const chatLogin = await loginOnChat(userData);

    if (chatLogin.success) {
      // Send verification OTP after successful registration
      try {
        await sendVerificationOTP(customer.id);
      } catch (otpError) {
        console.error("SEND_VERIFICATION_OTP_AFTER_REGISTER_FAILED", otpError);
        // Don't fail registration if OTP sending fails - they can resend later
      }

      // Create session and redirect to OTP verification page
      return createUserSession(
        chatLogin.token,
        customer.id,
        false, // rememberMe = false for auto-login after registration
        "/verify-otp" // Redirect to OTP verification instead of customer dashboard
      );
    } else {
      // If chat login fails, still return success but without auto-login
      console.error("AUTO_LOGIN_AFTER_REGISTRATION_FAILED", chatLogin.message);
      return {
        success: true,
        error: false,
        message: "Customer created successfully!",
      };
    }
  } catch (error: any) {
    console.log("INSERT_CUSTOMER_DATA_FAILED", error);

    if (error.code === "P2002") {
      const target = error.meta?.target;
      if (target === "customer_number_key") {
        throw new FieldValidationError({
          success: false,
          error: true,
          message: "This number is already exist! Try to create new!",
        });
      }
    }

    const auditBase = {
      action: "CUSTOMER_REGISTER",
      customer: "",
    };

    await createAuditLogs({
      ...auditBase,
      description: `Create new customer failed!`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to add customer, Try again later!",
    });
  }
}

// Send OTP via SMS using Telbiz
async function sendOtpTelbiz(
  phoneNumber: string,
  otp: string
): Promise<TelbizResult> {
  try {
    const msg = `Your OTP: ${otp}`;
    const phone = phoneNumber;

    const res = await tb.SendSMSAsync("OTP", phone, msg);
    return {
      success: true,
      data: res as TelbizResponse,
    };
  } catch (error: any) {
    console.error("Error sending OTP:", error);
    return {
      success: false,
      error: error as TelbizError,
    };
  }
}

export async function forgotPassword(whatsapp: number) {
  try {
    const customer = await prisma.customer.findFirst({
      where: { whatsapp: whatsapp },
    });

    const auditBase = {
      action: "FORGOT_PASSWORD",
      customer: customer?.id || "",
    };

    if (!customer) {
      await createAuditLogs({
        ...auditBase,
        description: `Password reset requested for non-existent phone: ${whatsapp}`,
        status: "failed",
        onError: new Error("Phone number not found"),
      });
      throw new Error("Phone number not found");
    }

    const resetToken = crypto.randomBytes(3).toString("hex").toUpperCase(); // 6 character token
    const resetTokenExpiry = new Date(Date.now() + 600000); // 10 minutes from now (token validity)
    const resendCooldown = new Date(Date.now() + 60000); // 60 seconds cooldown for resend

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        resetToken,
        resetTokenExpiry,
        updatedAt: resendCooldown, // Use updatedAt to track resend cooldown
      },
    });

    // Send SMS
    const sendRes = await sendOtpTelbiz(String(whatsapp), resetToken);
    if (sendRes.success === false) {
      await createAuditLogs({
        ...auditBase,
        description: `Send SMS to: ${whatsapp} by Telbiz failed!`,
        status: "failed",
        onSuccess: sendRes,
      });
      throw new Error("Send OTP to customer failed! Please try again later!");
    }
    await createAuditLogs({
      ...auditBase,
      description: `Send SMS to: ${whatsapp} by Telbiz successfully!`,
      status: "success",
      onSuccess: sendRes,
    });

    return {
      success: true,
      error: false,
      message: "Send OTP to customer success!",
    };
  } catch (error: any) {
    console.error("FORGOT_PASSWORD_ERROR", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to process forgot password request!",
    });
  }
}

export async function resendResetToken(whatsapp: number) {
  try {
    const customer = await prisma.customer.findFirst({
      where: {
        whatsapp: whatsapp,
      },
    });

    if (!customer) {
      return await forgotPassword(whatsapp);
    }

    // Check if user is within cooldown period (60 seconds from last request)
    const cooldownExpiry = new Date(customer.updatedAt.getTime());
    const now = new Date();

    if (cooldownExpiry > now) {
      throw new Error("Please wait 60 seconds before resending OTP!");
    }

    // If cooldown expired, send new OTP
    return await forgotPassword(whatsapp);
  } catch (error: any) {
    console.error("RESEND_RESET_TOKEN_ERROR", error);
    await createAuditLogs({
      action: "RESET_PASSWORD",
      customer: "",
      description: "Resend OTP failed for phone: " + whatsapp,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to resend OTP!",
    });
  }
}

export async function verifyResetToken(token: string) {
  try {
    const customer = await prisma.customer.findFirst({
      where: {
        resetToken: token.toUpperCase(),
        resetTokenExpiry: { gt: new Date() },
      },
      select: {
        id: true,
        whatsapp: true,
        resetTokenExpiry: true,
      },
    });

    if (!customer) {
      return { isValid: false, customer: null };
    }

    // Mark token as verified and extend expiry for reset
    const newExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes to reset
    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        resetTokenExpiry: newExpiry,
        resetTokenVerified: true, // new boolean flag
      },
    });
    return { isValid: true, customer };
  } catch (error) {
    console.error("VERIFY_RESET_TOKEN_ERROR", error);
    return { isValid: false, customer: null };
  }
}

export async function resetPassword(token: string, newPassword: string) {
  try {
    const customer = await prisma.customer.findFirst({
      where: {
        resetToken: token.toUpperCase(),
        resetTokenExpiry: {
          gt: new Date(), // Token not expired
        },
        resetTokenVerified: true, // Ensure token is verified
      },
    });

    const auditBase = {
      action: "RESET_PASSWORD",
      customer: customer?.id || "",
    };

    if (!customer) {
      await createAuditLogs({
        ...auditBase,
        description: `Password reset failed - invalid token: ${token}`,
        status: "failed",
        onError: customer,
      });

      return {
        success: false,
        error: true,
        message: "Invalid OTP code to reset user password!",
      };
    }

    const passwordHash = await hash(newPassword, 12);

    await prisma.customer.update({
      where: { id: customer.id },
      data: {
        password: passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        resetTokenVerified: null,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Password successfully reset for customer: ${customer.id}`,
      status: "success",
      onSuccess: { customerId: customer.id, passwordChanged: true },
    });

    return {
      success: true,
      error: false,
      message: "Reset password successfully!",
    };
  } catch (error: any) {
    console.error("RESET_PASSWORD_ERROR", error);

    await createAuditLogs({
      action: "RESET_PASSWORD",
      customer: "",
      description: `Password reset failed for token: ${token}`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to reset password, please try again!",
    });
  }
}

// ==================== PHONE VERIFICATION OTP ====================

/**
 * Generate and send verification OTP to customer's phone
 * Used after registration and for unverified customers on login
 */
export async function sendVerificationOTP(customerId: string) {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error("Customer not found!");
    }

    if (customer.isPhoneVerified) {
      return {
        success: true,
        alreadyVerified: true,
        message: "Phone is already verified!",
      };
    }

    const auditBase = {
      action: "SEND_VERIFICATION_OTP",
      customer: customerId,
    };

    // Generate 6-character OTP
    const verificationOTP = crypto.randomBytes(3).toString("hex").toUpperCase();
    const verificationOTPExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    await prisma.customer.update({
      where: { id: customerId },
      data: {
        verificationOTP,
        verificationOTPExpiry,
      },
    });

    // Send SMS via Telbiz
    const sendRes = await sendOtpTelbiz(String(customer.whatsapp), verificationOTP);
    if (sendRes.success === false) {
      await createAuditLogs({
        ...auditBase,
        description: `Send verification OTP to: ${customer.whatsapp} failed!`,
        status: "failed",
        onError: sendRes,
      });
      throw new Error("Failed to send OTP! Please try again later.");
    }

    await createAuditLogs({
      ...auditBase,
      description: `Verification OTP sent to: ${customer.whatsapp} successfully!`,
      status: "success",
      onSuccess: sendRes,
    });

    return {
      success: true,
      alreadyVerified: false,
      message: "OTP sent successfully!",
    };
  } catch (error: any) {
    console.error("SEND_VERIFICATION_OTP_ERROR", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to send verification OTP!",
    });
  }
}

/**
 * Resend verification OTP with cooldown check
 */
export async function resendVerificationOTP(customerId: string) {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error("Customer not found!");
    }

    if (customer.isPhoneVerified) {
      return {
        success: true,
        alreadyVerified: true,
        message: "Phone is already verified!",
      };
    }

    // Check cooldown (60 seconds from last OTP)
    if (customer.verificationOTPExpiry) {
      const lastSentTime = new Date(customer.verificationOTPExpiry.getTime() - 5 * 60 * 1000);
      const cooldownEnd = new Date(lastSentTime.getTime() + 60 * 1000);
      const now = new Date();

      if (cooldownEnd > now) {
        const remainingSeconds = Math.ceil((cooldownEnd.getTime() - now.getTime()) / 1000);
        throw new Error(`Please wait ${remainingSeconds} seconds before resending OTP!`);
      }
    }

    return await sendVerificationOTP(customerId);
  } catch (error: any) {
    console.error("RESEND_VERIFICATION_OTP_ERROR", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to resend OTP!",
    });
  }
}

/**
 * Verify the OTP code and mark phone as verified
 */
export async function verifyPhoneOTP(customerId: string, otp: string) {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId },
    });

    if (!customer) {
      throw new Error("Customer not found!");
    }

    if (customer.isPhoneVerified) {
      return {
        success: true,
        alreadyVerified: true,
        message: "Phone is already verified!",
      };
    }

    const auditBase = {
      action: "VERIFY_PHONE_OTP",
      customer: customerId,
    };

    // Check if OTP matches and not expired
    if (!customer.verificationOTP || !customer.verificationOTPExpiry) {
      await createAuditLogs({
        ...auditBase,
        description: "No OTP found for verification",
        status: "failed",
        onError: new Error("No OTP found"),
      });
      throw new Error("No OTP found. Please request a new OTP.");
    }

    if (new Date() > customer.verificationOTPExpiry) {
      await createAuditLogs({
        ...auditBase,
        description: "OTP expired",
        status: "failed",
        onError: new Error("OTP expired"),
      });
      throw new Error("OTP has expired. Please request a new OTP.");
    }

    if (customer.verificationOTP.toUpperCase() !== otp.toUpperCase()) {
      await createAuditLogs({
        ...auditBase,
        description: "Invalid OTP entered",
        status: "failed",
        onError: new Error("Invalid OTP"),
      });
      throw new Error("Invalid OTP. Please try again.");
    }

    // Mark phone as verified and clear OTP
    await prisma.customer.update({
      where: { id: customerId },
      data: {
        isPhoneVerified: true,
        verificationOTP: null,
        verificationOTPExpiry: null,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Phone verified successfully for customer: ${customerId}`,
      status: "success",
      onSuccess: { customerId },
    });

    return {
      success: true,
      alreadyVerified: false,
      message: "Phone verified successfully!",
    };
  } catch (error: any) {
    console.error("VERIFY_PHONE_OTP_ERROR", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to verify OTP!",
    });
  }
}

/**
 * Check if customer's phone is verified
 */
export async function isCustomerPhoneVerified(customerId: string): Promise<boolean> {
  try {
    const customer = await prisma.customer.findFirst({
      where: { id: customerId },
      select: { isPhoneVerified: true },
    });

    return customer?.isPhoneVerified ?? false;
  } catch (error) {
    console.error("CHECK_PHONE_VERIFIED_ERROR", error);
    return false;
  }
}

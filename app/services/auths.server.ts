import Telbiz from "telbiz";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { default as bcrypt } from "bcryptjs";

import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { UserStatus } from "~/interfaces/base";
import { createWallet } from "./wallet.server";
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

const sessionStorage = createCookieSessionStorage({
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

  return redirect("/login", {
    headers: {
      "Set-Cookie": [
        await sessionStorage.destroySession(session),
        `whoxa_customer_auth_token=; Path=/; HttpOnly; Secure; SameSite=Lax; Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
      ].join(", "),
    },
  });
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
}: ICustomerSigninCredentials) {
  const existingUser = await prisma.customer.findFirst({
    where: { whatsapp },
  });

  const auditBase = {
    action: "LOGIN",
    customer: existingUser?.id,
  };

  if (!existingUser) {
    const error = new Error(
      "Could not log you in, please check the provided credentials."
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
      "Could not log you in, Your account is unavailable now!"
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
      "Could not log you in, Your account is not available now."
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

    return createUserSession(
      chatLogin.token,
      existingUser.id,
      rememberMe,
      "/customer"
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

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(userData),
    });

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
      throw new Error("This phone number is already registered!");
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
        username: customerData.username,
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
      },
    });

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

      const userData: UserRegistrationData = {
        user_id: customer.id,
        country_code: locationDetails.countryCode,
        phone_number: String(customerData.whatsapp),
        country: locationDetails.countryCode,
        country_full_name: locationDetails.countryName,
        first_name: customerData.firstName,
        last_name: customerData.lastName || "",
        user_name: customerData.username,
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
    return {
      success: true,
      error: false,
      message: "Customer created successfully!",
    };
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

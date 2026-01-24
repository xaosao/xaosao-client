import Telbiz from "telbiz";
import crypto from "crypto";
import { randomUUID } from "crypto";
import { default as bcrypt } from "bcryptjs";

import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";
import { UserStatus } from "~/interfaces/base";
import { createWallet } from "./wallet.server";
import type { TelbizError, TelbizResponse } from "~/interfaces";
import { createCookieSessionStorage, redirect } from "react-router";
import { FieldValidationError, getLocationDetails } from "./base.server";
import { notifyAdminNewPendingModel } from "./email.server";

const { compare, hash } = bcrypt;
const MODEL_SESSION_SECRET =
  process.env.MODEL_SESSION_SECRET || process.env.SESSION_SECRET!;

// Model-specific interfaces
export interface IModelSigninCredentials {
  whatsapp: number;
  password: string;
  rememberMe: boolean;
  redirectTo?: string;
}

export interface IModelSignupCredentials {
  firstName: string;
  lastName?: string;
  username?: string;
  password: string;
  dob: string;
  gender: "male" | "female" | "other";
  whatsapp: number;
  bio?: string; // Optional for registration, can be added later in profile edit
  profile: string;
  address: string;
  career?: string;
  education?: string;
  interests?: string[];
  referrerId?: string; // ID of the model who referred this model
}

type TelbizResult = {
  success: boolean;
  data?: TelbizResponse;
  error?: TelbizError;
};

interface ModelRegistrationData {
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

interface ModelLogin {
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

// Separate session storage for models
const modelSessionStorage = createCookieSessionStorage({
  cookie: {
    name: "__model_session", // Different cookie name
    secure: false,
    secrets: [MODEL_SESSION_SECRET],
    sameSite: "lax",
    httpOnly: true,
  },
});

export async function getModelFromSession(request: Request) {
  const session = await modelSessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const modelId = session.get("modelId");

  if (!modelId) {
    return null;
  }

  return modelId;
}

export async function requireModelSession(request: Request) {
  const modelId = await getModelFromSession(request);

  if (!modelId) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    const publicPaths = [
      "/model-auth/login",
      "/model-auth/register",
      "/model-auth/forgot-password",
    ];
    const isPublic = publicPaths.includes(pathname);

    if (!isPublic) {
      throw redirect("/model-auth/login");
    }
  }

  return modelId;
}

// Get token from model session
export async function getModelTokenFromSession(request: Request) {
  const session = await modelSessionStorage.getSession(
    request.headers.get("Cookie")
  );
  const token = session.get("token");

  if (!token) {
    return null;
  }

  return token;
}

export async function destroyModelSession(request: Request) {
  const session = await modelSessionStorage.getSession(
    request.headers.get("Cookie")
  );

  const isProduction = process.env.NODE_ENV === "production";

  // Build cookie clearing headers that match the creation attributes
  const modelCookieParts = [
    `whoxa_model_auth_token=`,
    `Path=/`,
    `Max-Age=0`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ];

  const customerCookieParts = [
    `whoxa_customer_auth_token=`,
    `Path=/`,
    `Max-Age=0`,
    `SameSite=Lax`,
    `Expires=Thu, 01 Jan 1970 00:00:00 GMT`,
  ];

  if (isProduction) {
    modelCookieParts.push(`Domain=.xaosao.com`);
    modelCookieParts.push(`Secure`);
    customerCookieParts.push(`Domain=.xaosao.com`);
    customerCookieParts.push(`Secure`);
  }

  const headers = new Headers();
  headers.append("Set-Cookie", await modelSessionStorage.destroySession(session));
  headers.append("Set-Cookie", modelCookieParts.join("; "));
  headers.append("Set-Cookie", customerCookieParts.join("; "));

  return redirect("/", { headers });
}

export async function createModelSession(
  token: string,
  modelId: string,
  rememberMe: boolean,
  redirectPath: string
) {
  const isProduction = process.env.NODE_ENV === "production";
  // Session expiration: 24 hours default, 14 days with "Remember Me"
  const maxAge = rememberMe ? 14 * 24 * 60 * 60 : 1 * 24 * 60 * 60;

  // Create model session
  const session = await modelSessionStorage.getSession();
  session.set("modelId", modelId);
  session.set("token", token);

  // Build cookie header manually to avoid encoding
  const cookieParts = [
    `whoxa_model_auth_token=${token}`,
    `Path=/`,
    `Max-Age=${maxAge}`,
    `SameSite=Lax`,
  ];

  if (isProduction) {
    cookieParts.push(`Domain=.xaosao.com`);
    cookieParts.push(`Secure`);
  }

  const authCookieHeader = cookieParts.join("; ");
  const sessionHeader = await modelSessionStorage.commitSession(session, {
    maxAge,
  });

  const headers = new Headers();
  headers.append("Set-Cookie", authCookieHeader);
  headers.append("Set-Cookie", sessionHeader);

  return redirect(redirectPath, { headers });
}

// Login model to chat system
async function loginModelOnChat(modelData: ModelLogin): Promise<LoginResponse> {
  const url = `${process.env.VITE_API_URL}login-with-phone`;
  const bypassChatServer = process.env.BYPASS_CHAT_SERVER === "true";

  // If chat server is bypassed via env variable, return fallback token
  if (bypassChatServer) {
    console.warn("Chat server bypassed via BYPASS_CHAT_SERVER env variable.");
    return {
      token: `bypass-model-token-${modelData.phone_number}-${Date.now()}`,
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
      body: JSON.stringify(modelData),
    });

    // Check if response is JSON (chat server running) or HTML (chat server not running)
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // Chat server is not running or returning HTML error page
      console.warn(`Chat server at ${url} returned non-JSON response. Content-Type: ${contentType}`);
      if (process.env.NODE_ENV === "development") {
        console.warn("Chat server not running. Using development fallback token.");
        return {
          token: `dev-model-token-${modelData.phone_number}-${Date.now()}`,
          success: true,
          message: "Development mode: Chat server bypassed",
        };
      }
      throw new Error(`Chat server returned non-JSON response. Please check if the chat API is running at ${url}`);
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
    console.error("Model login to chat failed:", error);

    // Development fallback when chat server is unavailable
    if (process.env.NODE_ENV === "development") {
      console.warn("Chat server error. Using development fallback token.");
      return {
        token: `dev-model-token-${modelData.phone_number}-${Date.now()}`,
        success: true,
        message: "Development mode: Chat server bypassed",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "modelAuth.serverMessages.loginFailed",
    };
  }
}

export async function modelLogin({
  whatsapp,
  rememberMe,
  password,
  redirectTo,
}: IModelSigninCredentials) {
  const existingModel = await prisma.model.findFirst({
    where: { whatsapp },
  });

  const auditBase = {
    action: "MODEL_LOGIN",
    model: existingModel?.id,
  };

  if (!existingModel) {
    const error = new Error(
      "modelAuth.serverMessages.loginInvalidCredentials"
    ) as Error & {
      status?: number;
    };
    error.status = 401;

    await createAuditLogs({
      ...auditBase,
      description: `Model login failed, not user found`,
      status: "failed",
      onError: error,
    });

    throw error;
  }

  // console.log("Existing::::", existingModel);

  // Allow login for: verified (approved but hidden), active (visible)
  // Disallow: pending (awaiting approval), inactive, suspended, deleted
  const allowedStatuses = ["verified", "active"];
  if (!allowedStatuses.includes(existingModel.status)) {
    const error = new Error(
      "modelAuth.serverMessages.loginAccountUnavailable"
    ) as Error & {
      status?: number;
    };
    error.status = 401;

    await createAuditLogs({
      ...auditBase,
      description: `Model login failed, Model status is ${existingModel.status}!`,
      status: "failed",
      onError: error,
    });

    throw error;
  }

  const passwordCorrect = await compare(password, existingModel.password);
  if (!passwordCorrect) {
    const error = new Error(
      "modelAuth.serverMessages.loginInvalidCredentials"
    ) as Error & {
      status?: number;
    };
    error.status = 401;

    await createAuditLogs({
      ...auditBase,
      description: `Model login failed, password incorrect!`,
      status: "failed",
      onError: error,
    });
    throw error;
  }

  await createAuditLogs({
    ...auditBase,
    description: `Model login with: ${whatsapp}, successfully.`,
    status: "success",
    onSuccess: existingModel,
  });

  const modelData: ModelLogin = {
    phone_number: String(whatsapp),
    user_type: "model",
  };

  const chatLogin = await loginModelOnChat(modelData);

  if (chatLogin.success) {
    return createModelSession(
      chatLogin.token,
      existingModel.id,
      rememberMe,
      redirectTo || "/model"
    );
  } else {
    const error = new Error(
      `Failed to login to chat system: ${chatLogin.message || chatLogin.error}`
    ) as Error & {
      status?: number;
    };
    error.status = 500;

    await createAuditLogs({
      ...auditBase,
      description: `Chat login failed for model ${existingModel.id}. Error: ${chatLogin.message}`,
      status: "failed",
      onError: chatLogin.error,
    });

    throw error;
  }
}

// Register model to chat system
async function registerModelWithoutOTP(
  modelData: ModelRegistrationData
): Promise<RegistrationResponse> {
  const url = `${process.env.VITE_API_URL}register-without-otp`;
  const bypassChatServer = process.env.BYPASS_CHAT_SERVER === "true";

  // If chat server is bypassed via env variable, return success
  if (bypassChatServer) {
    console.warn("Chat server registration bypassed via BYPASS_CHAT_SERVER env variable.");
    return {
      success: true,
      data: { user_id: modelData.user_id },
      message: "Chat server bypassed",
    };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(modelData),
    });

    // Check if response is JSON (chat server running) or HTML (chat server not running)
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // Chat server is not running, use development fallback
      if (process.env.NODE_ENV === "development") {
        console.warn("Chat server not running. Using development fallback for model registration.");
        return {
          success: true,
          data: { user_id: modelData.user_id },
          message: "Development mode: Chat server bypassed",
        };
      }
      throw new Error("Chat server is not available");
    }

    const data: RegistrationResponse = await response.json();

    if (!data.success) {
      throw new Error(data.message || `HTTP error! status: ${response.status}`);
    }

    return {
      success: true,
      data: data,
      message: "modelAuth.serverMessages.registrationSuccess",
    };
  } catch (error) {
    console.error("Model registration to chat failed:", error);

    // Development fallback when chat server is unavailable
    if (process.env.NODE_ENV === "development") {
      console.warn("Chat server error. Using development fallback for model registration.");
      return {
        success: true,
        data: { user_id: modelData.user_id },
        message: "Development mode: Chat server bypassed",
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
      message: "modelAuth.serverMessages.registrationFailed",
    };
  }
}

// Register new model
export async function modelRegister(
  modelData: IModelSignupCredentials,
  ip: string,
  accessKey: string
) {
  if (!modelData)
    throw new Error("modelAuth.serverMessages.missingCreationData");

  try {
    const existingModel = await prisma.model.findFirst({
      where: { whatsapp: modelData.whatsapp },
    });

    if (existingModel) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "This phone number is already registered!",
        messageKey: "modelAuth.serverMessages.phoneAlreadyRegistered",
      });
    }

    const locationDetails = await getLocationDetails(ip, accessKey);
    const passwordHash = await hash(modelData.password, 12);

    // Get latest number and calculate next
    const latestModel = await prisma.model.findFirst({
      where: {
        firstName: {
          contains: "XSM-",
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    let nextNumber = "XSM-0001";
    if (latestModel?.firstName.includes("XSM-")) {
      const latestNumber = parseInt(
        latestModel.firstName.split("XSM-")[1] || "0"
      );
      const incremented = (latestNumber + 1).toString().padStart(4, "0");
      nextNumber = `XSM-${incremented}`;
    }

    const model = await prisma.model.create({
      data: {
        firstName: modelData.firstName,
        lastName: modelData.lastName,
        username: modelData.username || undefined,
        dob: new Date(modelData.dob),
        gender: modelData.gender,
        password: passwordHash,
        bio: modelData.bio,
        profile: modelData.profile,
        address: modelData.address,
        career: modelData.career,
        education: modelData.education,
        interests: modelData.interests,
        latitude: +locationDetails.latitude,
        longitude: +locationDetails.longitude,
        location: locationDetails,
        status: "pending", // Models start as pending approval
        whatsapp: modelData.whatsapp,
        available_status: "unavailable",
        hourly_rate_talking: 0,
        hourly_rate_video: 0,
        resetToken: randomUUID(),
        resetTokenVerified: false,
        resetTokenExpiry: null,
        twofactorOTP: randomUUID(),
        // Referral system - store who referred this model
        referredById: modelData.referrerId || null,
      },
    });

    console.log("Model created:", model);

    const auditBase = {
      action: "MODEL_REGISTER",
      model: model.id,
    };

    if (model.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create model: ${model.id} successfully!`,
        status: "success",
        onSuccess: model,
      });

      await createWallet(
        {
          totalBalance: 0,
          totalRecharge: 0,
          totalDeposit: 0,
          status: UserStatus.ACTIVE,
          model: model.id,
        },
        model.id
      );

      // Send email notification to admin about new pending model
      notifyAdminNewPendingModel({
        id: model.id,
        firstName: model.firstName,
        lastName: model.lastName,
        tel: modelData.whatsapp,
      });

      const modelChatData: ModelRegistrationData = {
        user_id: model.id,
        country_code: locationDetails.countryCode,
        phone_number: String(modelData.whatsapp),
        country: locationDetails.countryCode,
        country_full_name: locationDetails.countryName,
        first_name: modelData.firstName,
        last_name: modelData.lastName || "",
        user_name: modelData.username || String(modelData.whatsapp),
        gender: modelData.gender,
        profile_image: modelData.profile || "",
        user_type: "model",
      };

      const chatRes = await registerModelWithoutOTP(modelChatData);

      // If chat registration fails, rollback MongoDB data
      if (!chatRes.success) {
        // Create audit log BEFORE deleting the model
        await createAuditLogs({
          action: "MODEL_REGISTER",
          model: model.id,
          description: `Chat registration failed for model ${model.id}. Rolling back MongoDB data. Error: ${chatRes.message}`,
          status: "failed",
          onError: chatRes.error,
        });

        // Now delete wallet and model
        await prisma.wallet.deleteMany({
          where: { modelId: model.id },
        });

        await prisma.model.delete({
          where: { id: model.id },
        });

        throw new Error(
          `Failed to register model in chat system: ${chatRes.message || chatRes.error}`
        );
      }
    }

    // No auto-login for models - they must wait for admin approval
    // Only verified/active status models can login
    return {
      success: true,
      error: false,
      message: "modelAuth.serverMessages.registrationSuccess",
    };
  } catch (error: any) {
    console.log("INSERT_MODEL_DATA_FAILED", error);

    if (error.code === "P2002") {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "modelAuth.serverMessages.phoneAlreadyRegistered",
      });
    }

    const auditBase = {
      action: "MODEL_REGISTER",
      model: "",
    };

    await createAuditLogs({
      ...auditBase,
      description: `Create new model failed!`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "modelAuth.serverMessages.registrationFailed",
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

export async function modelForgotPassword(whatsapp: number) {
  try {
    const model = await prisma.model.findFirst({
      where: { whatsapp: whatsapp },
    });

    const auditBase = {
      action: "MODEL_FORGOT_PASSWORD",
      model: model?.id || "",
    };

    if (!model) {
      await createAuditLogs({
        ...auditBase,
        description: `Password reset requested for non-existent phone: ${whatsapp}`,
        status: "failed",
        onError: new Error("modelAuth.serverMessages.phoneNotFound"),
      });
      throw new Error("modelAuth.serverMessages.phoneNotFound");
    }

    const resetToken = crypto.randomBytes(3).toString("hex").toUpperCase();
    const resetTokenExpiry = new Date(Date.now() + 600000); // 10 minutes
    const resendCooldown = new Date(Date.now() + 60000); // 60 seconds

    await prisma.model.update({
      where: { id: model.id },
      data: {
        resetToken,
        resetTokenExpiry,
        updatedAt: resendCooldown,
      },
    });

    const sendRes = await sendOtpTelbiz(String(whatsapp), resetToken);
    if (sendRes.success === false) {
      await createAuditLogs({
        ...auditBase,
        description: `Send SMS to: ${whatsapp} by Telbiz failed!`,
        status: "failed",
        onSuccess: sendRes,
      });
      throw new Error("modelAuth.serverMessages.sendOtpFailed");
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
      message: "modelAuth.serverMessages.sendOtpSuccess",
    };
  } catch (error: any) {
    console.error("MODEL_FORGOT_PASSWORD_ERROR", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "modelAuth.serverMessages.forgotPasswordFailed",
    });
  }
}

export async function modelResetPassword(token: string, newPassword: string) {
  try {
    const model = await prisma.model.findFirst({
      where: {
        resetToken: token.toUpperCase(),
        resetTokenExpiry: {
          gt: new Date(),
        },
        resetTokenVerified: true,
      },
    });

    const auditBase = {
      action: "MODEL_RESET_PASSWORD",
      model: model?.id || "",
    };

    if (!model) {
      await createAuditLogs({
        ...auditBase,
        description: `Password reset failed - invalid token: ${token}`,
        status: "failed",
        onError: model,
      });

      return {
        success: false,
        error: true,
        message: "modelAuth.serverMessages.invalidOtpCode",
      };
    }

    const passwordHash = await hash(newPassword, 12);

    await prisma.model.update({
      where: { id: model.id },
      data: {
        password: passwordHash,
        resetToken: null,
        resetTokenExpiry: null,
        resetTokenVerified: null,
      },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Password successfully reset for model: ${model.id}`,
      status: "success",
      onSuccess: { modelId: model.id, passwordChanged: true },
    });

    return {
      success: true,
      error: false,
      message: "modelAuth.serverMessages.resetPasswordSuccess",
    };
  } catch (error: any) {
    console.error("MODEL_RESET_PASSWORD_ERROR", error);

    await createAuditLogs({
      action: "MODEL_RESET_PASSWORD",
      model: "",
      description: `Password reset failed for token: ${token}`,
      status: "failed",
      onError: error,
    });

    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "modelAuth.serverMessages.resetPasswordFailed",
    });
  }
}

export async function modelVerifyResetToken(token: string) {
  try {
    const model = await prisma.model.findFirst({
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

    if (!model) {
      return { isValid: false, model: null };
    }

    const newExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await prisma.model.update({
      where: { id: model.id },
      data: {
        resetTokenExpiry: newExpiry,
        resetTokenVerified: true,
      },
    });

    return { isValid: true, model };
  } catch (error) {
    console.error("MODEL_VERIFY_RESET_TOKEN_ERROR", error);
    return { isValid: false, model: null };
  }
}

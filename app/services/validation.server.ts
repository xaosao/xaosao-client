import { z } from "zod";
import type {
  ICustomerForgotCredentials,
  ICustomerSigninCredentials,
  ICustomerSignupCredentials,
  IOTPCredentials,
  IResetPasswordCredentials,
} from "~/interfaces";
import type {
  ICustomerCredentials,
  ICustomerSettingCredentials,
} from "~/interfaces/customer";
import type { ISubscriptionCredentials } from "~/interfaces/packages";
import type { IServiceBookingCredentials } from "~/interfaces/service";
import type { ITransactionCredentials } from "~/interfaces/transaction";

// Basic SQLi blocker
const blockInjection = (value: string) => {
  return !/('|--|\/\/|\/\*|\*\/|;|\b(select|insert|update|delete|drop|alter|create|exec|execute|union|grant|revoke|truncate|xp_cmdshell|call|declare)\b|\b(or|and)\b\s+\d+=\d+|\bOR\b\s+['"]?\d+['"]?\s*=\s*['"]?|<script.*?>.*?<\/script>|javascript:|on\w+=["'].*?["'])/gis.test(
    value
  );
};

const refineSafe = (schema: z.ZodString) =>
  schema
    .refine((val) => val.trim().length > 0, {
      message: "Field cannot be empty.",
    })
    .refine(blockInjection, { message: "Potentially unsafe input detected." });

// ====================== Admin sign input validate
const signInSchema = z.object({
  rememberMe: z.boolean(),
  password: refineSafe(z.string()),
  whatsapp: z
    .number()
    .min(1000000000, "Whatsapp number must be exactly 10 digits.")
    .max(9999999999, "Whastapp number must be exactly 10 digits."),
});

export function validateSignInInputs(input: ICustomerSigninCredentials) {
  const result = signInSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Admin sign input validate:
const customerSignUpSchema = z.object({
  firstName: refineSafe(
    z
      .string()
      .max(20, "Invalid first name. Must be at most 20 characters long.")
  ),
  lastName: refineSafe(
    z.string().max(20, "Invalid last name. Must be at most 20 characters long.")
  ),
  password: refineSafe(
    z.string().min(8, "Invalid password. Must be at least 8 characters long.")
  ),
  gender: z
    .string()
    .refine((val) => ["male", "female", "other"].includes(val), {
      message: "Invalid gender. Must be one of: male, female, other.",
    }),
  dob: z.string().refine((date) => {
    const parsedDate = new Date(date);
    return !isNaN(parsedDate.getTime());
  }, {
    message: "Invalid date format. Please enter a valid date.",
  }),
  whatsapp: z
    .number()
    .min(1000000000, "Whatsapp number must be exactly 10 digits.")
    .max(9999999999, "Whastapp number must be exactly 10 digits."),
  profile: z.string().url("Invalid profile image URL."),
});

export function validateCustomerSignupInputs(
  input: ICustomerSignupCredentials
) {
  const result = customerSignUpSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Forgot password input validate:
const forgotSchema = z.object({
  whatsapp: z
    .number()
    .min(1000000000, "Phone number must be exactly 10 digits.")
    .max(9999999999, "Phone number must be exactly 10 digits."),
});

export function validateForgotInputs(input: ICustomerForgotCredentials) {
  const result = forgotSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Verify input validate:
const verifyOTPSchema = z.object({
  otp: refineSafe(z.string().length(6, "OTP must be exactly 6 characters.")),
});

export function validateVerifyOTPInputs(input: IOTPCredentials) {
  const result = verifyOTPSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Reset password input validate
const resetPasswordSchema = z.object({
  password: refineSafe(z.string()),
});

export function validateResetPasswordInputs(input: IResetPasswordCredentials) {
  const result = resetPasswordSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Reset password input validate
const topUpSchema = z.object({
  amount: z.number().min(5, "Base rate should be at least 5 digits."),
});

export function validateTopUpInputs(input: ITransactionCredentials) {
  const result = topUpSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Validate cusotmer profile inputs:
const updateProfileSchema = z.object({
  firstName: refineSafe(
    z
      .string()
      .max(20, "Invalid first name. Must be at most 20 characters long.")
  ),
  lastName: refineSafe(
    z.string().max(20, "Invalid last name. Must be at most 20 characters long.")
  ),
  dob: z.coerce.date().refine((date) => !isNaN(date.getTime()), {
    message: "Invalid date format. Please enter a valid date.",
  }),
  gender: z
    .string()
    .refine((val) => ["male", "female", "other"].includes(val), {
      message: "Invalid gender. Must be one of: male, female, other.",
    }),
  whatsapp: z
    .number()
    .min(1000000000, "Whatsapp number must be exactly 10 digits.")
    .max(9999999999, "Whastapp number must be exactly 10 digits."),

  // Optional fields
  profile: z.string().url("Invalid profile URL.").nullable().optional(),

  interests: z.string().nullable().optional().default(null),

  relationshipStatus: z
    .string()
    .max(50, "Relationship status must be at most 50 characters long.")
    .nullable()
    .optional(),

  bio: z
    .string()
    .max(300, "Bio must be at most 300 characters long.")
    .nullable()
    .optional(),

  career: z
    .string()
    .max(100, "Career must be at most 100 characters long.")
    .nullable()
    .optional(),

  education: z
    .string()
    .max(100, "Education must be at most 100 characters long.")
    .nullable()
    .optional(),
});

export function validateUpdateProfileInputs(input: ICustomerCredentials) {
  const result = updateProfileSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Validate cusotmer basic info on setting:
const customerSettingSchema = z.object({
  twofactorEnabled: z.boolean(),
  notifications_email: z.boolean(),
  notifications_push: z.boolean(),
  notifications_sms: z.boolean(),
  defaultLanguage: z
    .string()
    .min(2, "Language code must be at least 2 characters long.")
    .max(10, "Language code must be at most 10 characters long.")
    .regex(/^[a-z-]+$/i, "Invalid language format."),
  defaultTheme: z
    .string()
    .refine(
      (val) => ["light", "dark", "system"].includes(val),
      "Theme must be one of: light, dark, or system."
    ),
});

export function validateICustomerSettingInputs(
  input: ICustomerSettingCredentials
) {
  const result = customerSettingSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

// ====================== Report on setting input validate
const reportSchema = z.object({
  type: z.string().min(1, "Type is required."),
  title: z.string().min(1, "Title is required."),
  description: z.string().min(1, "Description is required."),
});

export function validateReportUpInputs(input: {
  type: string;
  title: string;
  description: string;
}) {
  const result = reportSchema.safeParse(input);
  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }

  return result.data;
}

// ====================== Report on setting input validate
const bookingServiceSchema = z.object({
  startDate: z.coerce.date().refine((date) => !isNaN(date.getTime()), {
    message: "Invalid end date format. Please enter a valid start date.",
  }),
  price: z.number().min(10000, "Price should be 5 digits at least!"),
  dayAmount: z.number().optional(),  // Optional for per_hour and per_session
  hours: z.number().min(2).max(10).optional(),  // For per_hour services (2-10 hours)
  sessionType: z.enum(['one_time', 'one_night']).optional(),  // For per_session services
  location: refineSafe(
    z
      .string()
      .max(1000, "Invalid location. Must be at most 1000 characters long!")
  ),
});

export function validateServiceBookingInputs(
  input: IServiceBookingCredentials
) {
  const result = bookingServiceSchema.safeParse(input);
  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }

  return result.data;
}

// ====================== Subscription credentials validate
const subscriptionSchema = z.object({
  amount: z.number().max(7, "Base rate should be at least 5 digits."),
  planId: refineSafe(z.string()),
  paymentSlip: z.string(),
});

export function validateSubscriptionInputs(input: ISubscriptionCredentials) {
  const result = subscriptionSchema.safeParse(input);

  if (!result.success) {
    const errors: Partial<Record<string, string>> = {};
    for (const issue of result.error.issues) {
      const key = issue.path[0] as string;
      errors[key] = issue.message;
    }
    throw errors;
  }
  return result.data;
}

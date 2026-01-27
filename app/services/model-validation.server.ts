import { z } from "zod";
import type {
  IModelSigninCredentials,
  IModelSignupCredentials,
} from "~/services/model-auth.server";

/**
 * Enhanced SQL injection and XSS protection
 * Blocks only dangerous patterns while allowing common special characters
 * Allowed: $, !, @, #, %, *, (, ), -, +, and other common punctuation
 * Blocked:
 * - Path traversal: ../, ..\, //
 * - Script tags: <script>, <, >
 * - SQL injection keywords and patterns
 * - JavaScript protocols
 */
const blockInjection = (value: string): boolean => {
  // Path traversal patterns - DANGEROUS
  const pathTraversalPatterns = [
    /\.\.\//g, // Directory traversal ../
    /\.\.\\/g, // Windows directory traversal ..\
    /%2e%2e\//gi, // URL-encoded traversal %2e%2e/
    /\/\//g, // Double slashes //
  ];

  // HTML/Script tags - DANGEROUS
  const htmlTagPatterns = [
    /<script[\s\S]*?>/gi, // <script> opening tag
    /<\/script>/gi, // </script> closing tag
    /<iframe[\s\S]*?>/gi, // <iframe> tags
    /<object[\s\S]*?>/gi, // <object> tags
    /<embed[\s\S]*?>/gi, // <embed> tags
    /<.*?>/g, // Any HTML tag with < and >
  ];

  // JavaScript protocols - DANGEROUS
  const scriptProtocolPatterns = [
    /javascript:/gi, // javascript: protocol
    /vbscript:/gi, // VBScript protocol
    /data:text\/html/gi, // Data URI for HTML
  ];

  // SQL Injection - DANGEROUS
  const sqlPatterns = [
    /\b(select|insert|update|delete|drop|alter|create|exec|execute|union|grant|revoke|truncate|xp_cmdshell|call|declare|merge)\b\s+(from|into|table|database|user)/gi, // SQL keywords with common follow-up words
    /(union\s+all\s+select|union\s+select)/gi, // UNION-based attacks
    /\b(or|and)\b\s+['"]?\d+['"]?\s*=\s*['"]?\d+['"]?/gi, // OR '1'='1', AND 1=1
    /;.*?(drop|delete|update|insert)/gi, // SQL terminator followed by dangerous keywords
  ];

  // Event handlers - DANGEROUS
  const eventHandlerPatterns = [
    /on\w+\s*=\s*["'].*?["']/gi, // Event handlers: onclick=, onerror=, etc.
    /eval\s*\(/gi, // eval() function
    /expression\s*\(/gi, // CSS expression()
  ];

  // Test all dangerous patterns
  const dangerousPatterns = [
    ...pathTraversalPatterns,
    ...htmlTagPatterns,
    ...scriptProtocolPatterns,
    ...sqlPatterns,
    ...eventHandlerPatterns,
  ];

  return !dangerousPatterns.some((pattern) => pattern.test(value));
};

/**
 * Creates a refined string schema with:
 * 1. Trimming whitespace
 * 2. Empty value check
 * 3. SQL injection & XSS protection
 */
const refineSafe = (schema: z.ZodString) =>
  schema
    .trim()
    .refine((val) => val.length > 0, {
      message: "modelAuth.validation.fieldCannotBeEmpty",
    })
    .refine(blockInjection, {
      message: "modelAuth.validation.invalidInputDetected",
    });

/**
 * Sanitizes phone number input
 * - Removes all non-digit characters
 * - Validates length
 */
const sanitizePhoneNumber = (value: unknown): number => {
  if (typeof value === "number") return value;
  if (typeof value !== "string")
    throw new Error("modelAuth.validation.invalidPhoneNumberType");

  // Remove all non-digit characters
  const digitsOnly = value.replace(/\D/g, "");

  // Convert to number
  const phoneNumber = parseInt(digitsOnly, 10);

  if (isNaN(phoneNumber)) {
    throw new Error("modelAuth.validation.phoneNumberDigitsOnly");
  }

  return phoneNumber;
};

/**
 * Phone number validation schema
 * - Must be exactly 10 digits
 * - Only numeric characters allowed
 * - Common Lao phone prefixes: 20, 30, etc.
 */
const phoneNumberSchema = z
  .union([z.string(), z.number()])
  .transform(sanitizePhoneNumber)
  .refine((val) => val >= 1000000000 && val <= 9999999999, {
    message: "modelAuth.validation.phoneNumberExactly10Digits",
  })
  .refine(
    (val) => {
      const str = val.toString();
      // Validate Lao phone number format (starts with 20, 30, etc.)
      return /^[2-9]\d{9}$/.test(str);
    },
    {
      message: "modelAuth.validation.invalidLaoPhoneNumber",
    }
  );

// ====================== Model Sign In Validation ======================

const modelSignInSchema = z.object({
  whatsapp: phoneNumberSchema,
  password: refineSafe(
    z
      .string()
      .min(8, "modelAuth.validation.passwordMinLength")
      .max(128, "modelAuth.validation.passwordTooLong")
  ),
  rememberMe: z.boolean(),
});

export function validateModelSignInInputs(input: IModelSigninCredentials) {
  const result = modelSignInSchema.safeParse(input);

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

// ====================== Model Sign Up Validation ======================

const modelSignUpSchema = z
  .object({
    firstName: refineSafe(
      z
        .string()
        .min(2, "modelAuth.validation.firstNameMinLength")
        .max(50, "modelAuth.validation.firstNameMaxLength")
        .regex(/^[a-zA-Z\s\u0E80-\u0EFF]+$/, {
          message: "modelAuth.validation.firstNameLettersOnly",
        })
    ),
    lastName: z
      .string()
      .trim()
      .max(50, "modelAuth.validation.lastNameMaxLength")
      .regex(/^[a-zA-Z\s\u0E80-\u0EFF]*$/, {
        message: "modelAuth.validation.lastNameLettersOnly",
      })
      .optional()
      .or(z.literal("")),
    password: refineSafe(
      z
        .string()
        .min(8, "modelAuth.validation.passwordMinLength")
        .max(128, "modelAuth.validation.passwordTooLong")
    ),
    dob: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, {
        message: "modelAuth.validation.dobFormat",
      })
      .refine(
        (date) => {
          const birthDate = new Date(date);
          const today = new Date();
          const age = today.getFullYear() - birthDate.getFullYear();
          return age >= 18 && age <= 100;
        },
        {
          message: "modelAuth.validation.ageRequirement",
        }
      ),
    gender: z.enum(["male", "female", "other"], {
      message: "modelAuth.validation.genderRequired",
    }),
    whatsapp: phoneNumberSchema,
    bio: z
      .string()
      .trim()
      .min(10, "modelAuth.validation.bioMinLength")
      .max(500, "modelAuth.validation.bioMaxLength")
      .refine(blockInjection, {
        message: "modelAuth.validation.invalidBioInput",
      })
      .optional()
      .or(z.literal("")),
    profile: z.string().url("modelAuth.validation.invalidProfileImageUrl"),
    address: refineSafe(
      z
        .string()
        .min(5, "modelAuth.validation.addressMinLength")
        .max(200, "modelAuth.validation.addressMaxLength")
    ),
    career: z
      .string()
      .trim()
      .max(100, "modelAuth.validation.careerMaxLength")
      .refine(blockInjection, {
        message: "modelAuth.validation.invalidCareerInput",
      })
      .optional()
      .or(z.literal("")),
    education: z
      .string()
      .trim()
      .max(100, "modelAuth.validation.educationMaxLength")
      .refine(blockInjection, {
        message: "modelAuth.validation.invalidEducationInput",
      })
      .optional()
      .or(z.literal("")),
    interests: z
      .array(
        z
          .string()
          .trim()
          .min(1, "modelAuth.validation.interestCannotBeEmpty")
          .max(50, "modelAuth.validation.interestMaxLength")
          .refine(blockInjection, {
            message: "modelAuth.validation.invalidInterestInput",
          })
      )
      .max(10, "modelAuth.validation.maxInterests")
      .optional(),
    // Referral system - ID of the model who referred this user
    referrerId: z.string().optional(),
  })
  .strict(); // Reject any extra fields not defined in schema

export function validateModelSignUpInputs(input: IModelSignupCredentials) {
  const result = modelSignUpSchema.safeParse(input);

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

// ====================== Model Forgot Password Validation ======================
const modelForgotPasswordSchema = z.object({
  whatsapp: phoneNumberSchema,
});

export function validateModelForgotPasswordInputs(input: { whatsapp: number }) {
  const result = modelForgotPasswordSchema.safeParse(input);

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

// ====================== Model Reset Password Validation ======================
const modelResetPasswordSchema = z
  .object({
    token: z
      .string()
      .trim()
      .length(6, "modelAuth.validation.resetTokenLength")
      .regex(/^[A-F0-9]{6}$/, {
        message: "modelAuth.validation.invalidTokenFormat",
      }),
    password: refineSafe(
      z
        .string()
        .min(8, "modelAuth.validation.passwordMinLength")
        .max(128, "modelAuth.validation.passwordTooLong")
    ),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "modelAuth.validation.passwordsDoNotMatch",
    path: ["confirmPassword"],
  });

export function validateModelResetPasswordInputs(input: {
  token: string;
  password: string;
  confirmPassword: string;
}) {
  const result = modelResetPasswordSchema.safeParse(input);

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

import { prisma } from "./database.server";
import { default as bcrypt } from "bcryptjs";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./base.server";
import type {
  ICustomerCredentials,
  ICustomerSettingCredentials,
} from "~/interfaces/customer";
const { compare, hash } = bcrypt;

// get customer profile (for model viewing customer)
export async function getCustomerProfile(customerId: string, modelId?: string) {
  if (!customerId) throw new Error("Missing customer id!");

  try {
    const customer = await prisma.customer.findFirst({
      where: {
        id: customerId,
        status: "active",
      },
      select: {
        id: true,
        number: true,
        firstName: true,
        lastName: true,
        dob: true,
        gender: true,
        latitude: true,
        longitude: true,
        country: true,
        ip: true,
        whatsapp: true,
        profile: true,
        status: true,
        interests: true,
        relationshipStatus: true,
        bio: true,
        career: true,
        education: true,
        sendMailNoti: true,
        sendSMSNoti: true,
        sendPushNoti: true,
        defaultLanguage: true,
        defaultTheme: true,
        twofactorEnabled: true,
        createdAt: true,
        Images: {
          where: {
            status: "active",
          },
          select: {
            id: true,
            name: true,
          },
        },
        _count: {
          select: {
            customer_interactions: true,
          },
        },
        // Include friend_contacts to check if model is already a friend
        friend_contacts: modelId
          ? {
              where: { modelId },
              select: { id: true },
            }
          : false,
        // Include model_interactions to check if model already liked/passed
        model_interactions: modelId
          ? {
              where: { modelId },
              select: { action: true },
            }
          : false,
      },
    });

    if (!customer) {
      const error = new Error("The customer does not exist!") as any;
      error.status = 404;
      throw error;
    }

    // Get likes from models (model_interactions) and friend count
    const [likeCount, friendCount] = await Promise.all([
      prisma.model_interactions.count({
        where: {
          customerId,
          action: "LIKE",
        },
      }),
      prisma.friend_contacts.count({
        where: {
          customerId,
        },
      }),
    ]);

    // Derive isContact and modelAction
    const friendContacts = (customer as any).friend_contacts || [];
    const modelInteractions = (customer as any).model_interactions || [];

    return {
      ...customer,
      interactions: {
        likeCount,
        friendCount,
      },
      isContact: friendContacts.length > 0,
      modelAction: modelInteractions.length > 0 ? modelInteractions[0].action : null,
    };
  } catch (error) {
    console.error("GET_CUSTOMER_FAILED", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to get customer profile information!",
    });
  }
}

// Update profile
export async function updateProfile(
  customerId: string,
  data: ICustomerCredentials
) {
  // console.log("DDAATTAA", data);

  if (!customerId)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing customer id!",
    });

  const auditBase = {
    action: "UPDATE_CUSTOMER_PROFILE",
    customer: customerId,
  };

  try {
    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
    });

    if (!customer) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The customer does not exist!",
      });
    }

    const updateCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        dob: new Date(data.dob),
        gender: data.gender,
        whatsapp: +data.whatsapp,
        relationshipStatus: data.relationshipStatus,
        bio: data.bio,
        career: data.career,
        education: data.education,
        profile: data.profile,
        interests: data.interests,
      },
    });

    if (updateCustomer.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update customer: ${updateCustomer.id} profile successfully.`,
        status: "success",
        onSuccess: updateCustomer,
      });
    }

    return updateCustomer;
  } catch (error: any) {
    console.error("UPDATE_CUSOTMER_PROFILE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update customer profile failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to update customer profile!",
    });
  }
}

// insert customer image:
export async function createCustomerImage(customerId: string, image: string) {
  if (!customerId)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing customer id!",
    });

  const auditBase = {
    action: "CREATE_CUSTOMER_IMAGES",
    customer: customerId,
  };

  try {
    const createCustomerImage = await prisma.images.create({
      data: {
        name: image,
        status: "active",
        customerId,
      },
    });

    if (createCustomerImage.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create customer: ${createCustomerImage.id} image successfully.`,
        status: "success",
        onSuccess: createCustomerImage,
      });
    }

    return createCustomerImage;
  } catch (error: any) {
    console.error("CREATE_CUSOTMER_IMAGE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Create customer image failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to create customer image!",
    });
  }
}

// update customer image with ID:
export async function updateCustomerImage(
  id: string,
  customerId: string,
  image: string
) {
  if (!customerId)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing customer id!",
    });

  const auditBase = {
    action: "UPDATE_CUSTOMER_IMAGE",
    customer: customerId,
  };

  try {
    const customerImage = await prisma.images.findUnique({
      where: {
        id,
        customerId,
      },
    });

    if (!customerImage) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The image does not exist!",
      });
    }

    const updateCustomerImage = await prisma.images.update({
      where: {
        id: customerImage.id,
      },
      data: {
        name: image,
      },
    });

    if (updateCustomerImage.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update customer: ${updateCustomerImage.id} image successfully.`,
        status: "success",
        onSuccess: updateCustomerImage,
      });
    }
    return updateCustomerImage;
  } catch (error: any) {
    console.error("UPDATE_CUSOTMER_IMAGE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update customer image failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to update customer image!",
    });
  }
}

// Update customer password
export async function changeCustomerPassword(
  customerId: string,
  oldPassword: string,
  password: string
) {
  if (!customerId || !password)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Invalid credentials inputs!",
    });

  const auditBase = {
    action: "UPDATE_CUSTOMER_PASSWORD",
    customer: customerId,
  };

  try {
    const existingUser = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
    });

    if (!existingUser) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Customer does not exist!",
      });
    }

    const passwordCorrect = await compare(oldPassword, existingUser.password);
    if (!passwordCorrect) {
      await createAuditLogs({
        ...auditBase,
        description: `Login failed, password incorrect!`,
        status: "failed",
        onError:
          "Compare between old password input and the password from db not match!",
      });
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "Your old password incorrect!",
      });
    }

    const passwordHash = await hash(password, 12);

    const updatePassword = await prisma.customer.update({
      where: {
        id: existingUser.id,
      },
      data: {
        password: passwordHash,
      },
    });

    if (updatePassword.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update customer: ${updatePassword.id} password successfully.`,
        status: "success",
        onSuccess: updatePassword,
      });
    }
    return updatePassword;
  } catch (error: any) {
    console.error("UPDATE_CUSOTMER_PASSWORD_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update customer password failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to update customer password!",
    });
  }
}

// Update customer setting
export async function updateCustomerSetting(
  customerId: string,
  data: ICustomerSettingCredentials
) {
  if (!customerId)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing customer id!",
    });

  const auditBase = {
    action: "UPDATE_CUSTOMER_PROFILE_SETTING",
    customer: customerId,
  };

  try {
    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
    });

    if (!customer) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The customer does not exist!",
      });
    }

    const updateCustomer = await prisma.customer.update({
      where: { id: customerId },
      data: {
        twofactorEnabled: data.twofactorEnabled,
        defaultLanguage: data.defaultLanguage,
        defaultTheme: data.defaultTheme,
        sendMailNoti: data.notifications_email,
        sendPushNoti: data.notifications_push,
        sendSMSNoti: data.notifications_sms,
      },
    });

    if (updateCustomer.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update customer: ${updateCustomer.id} profile setting successfully.`,
        status: "success",
        onSuccess: updateCustomer,
      });
    }

    return updateCustomer;
  } catch (error: any) {
    console.error("UPDATE_CUSOTMER_PROFILE_SETTING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update customer profile setting failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to update customer profile setting!",
    });
  }
}

// Create report:
export async function createReport(
  customerId: string,
  type: string,
  title: string,
  description: string
) {
  if (!customerId || !type || !title || !description)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing customer id!",
    });

  const auditBase = {
    action: "CREATE_REPORT",
    customer: customerId,
  };

  console.log(customerId, type, title, description);

  try {
    const createReport = await prisma.reports.create({
      data: {
        type,
        title,
        description,
        customerId,
      },
    });

    if (createReport.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Customer: ${createReport.id} report successfully.`,
        status: "success",
        onSuccess: createReport,
      });
    }

    return createReport;
  } catch (error: any) {
    console.error("CREATE_REPORT", error);
    await createAuditLogs({
      ...auditBase,
      description: `Customer create report failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to create report!",
    });
  }
}

// Update chat profile (sync with chat backend)
export async function updateChatProfile(
  authToken: string,
  data: {
    phone_number: string;
    first_name: string;
    last_name: string;
    profile_image: string;
  }
) {
  const url = `${process.env.VITE_API_URL}update-profile`;
  const bypassChatServer = process.env.BYPASS_CHAT_SERVER === "true";

  // If chat server is bypassed via env variable, return success
  if (bypassChatServer) {
    console.warn("Chat server profile update bypassed via BYPASS_CHAT_SERVER env variable.");
    return { success: true, data: null, message: "Chat server bypassed" };
  }

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        phone_number: data.phone_number,
        first_name: data.first_name,
        last_name: data.last_name,
        profile_image: data.profile_image,
      }),
    });

    // Check if response is JSON (chat server running) or HTML (chat server not running)
    const contentType = response.headers.get("content-type");
    if (!contentType || !contentType.includes("application/json")) {
      // Chat server is not running, use development fallback
      if (process.env.NODE_ENV === "development") {
        console.warn("Chat server not running. Using development fallback for profile update.");
        return { success: true, data: null, message: "Development mode: Chat server bypassed" };
      }
      return { success: false, message: "Chat server is not available" };
    }

    const result = await response.json();

    if (!result.success) {
      console.error("Failed to update chat profile:", result.message);
      return { success: false, message: result.message };
    }

    console.log("Chat profile updated successfully");
    return { success: true, data: result.data };
  } catch (error) {
    console.error("Error updating chat profile:", error);

    // Development fallback when chat server is unavailable
    if (process.env.NODE_ENV === "development") {
      console.warn("Chat server error. Using development fallback for profile update.");
      return { success: true, data: null, message: "Development mode: Chat server bypassed" };
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : "Failed to update chat profile",
    };
  }
}

// Delete self account
export async function deleteAccount(customerId: string) {
  if (!customerId)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing customer id!",
    });

  const auditBase = {
    action: "DELETE_SELF_ACCOUNT",
    customer: customerId,
  };

  try {
    const customer = await prisma.customer.findUnique({
      where: {
        id: customerId,
      },
    });

    if (!customer) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The customer does not exist!",
      });
    }

    const deleteCustomer = await prisma.customer.update({
      where: {
        id: customer.id,
      },
      data: {
        status: "inactive",
      },
    });

    if (deleteCustomer.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create customer: ${deleteCustomer.id} image successfully.`,
        status: "success",
        onSuccess: deleteCustomer,
      });
    }

    return deleteCustomer;
  } catch (error: any) {
    console.error("DELETE_CUSTOMER_ACCOUNT", error);
    await createAuditLogs({
      ...auditBase,
      description: `Delete cusotmer account failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to customer account!",
    });
  }
}

import { prisma } from "./database.server";
import { default as bcrypt } from "bcryptjs";
import { createAuditLogs } from "./log.server";
import { FieldValidationError } from "./base.server";
import type {
  IModelProfileCredentials,
  IModelSettingCredentials,
} from "~/interfaces/model-profile";
const { compare, hash } = bcrypt;

// Get model's own profile
export async function getModelOwnProfile(modelId: string) {
  if (!modelId) throw new Error("Missing model id!");

  try {
    const model = await prisma.model.findFirst({
      where: {
        id: modelId,
        // No status filter - logged-in models should see their own profile regardless of status
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        username: true,
        dob: true,
        gender: true,
        bio: true,
        whatsapp: true,
        address: true,
        available_status: true,
        profile: true,
        latitude: true,
        longitude: true,
        location: true,
        hourly_rate_talking: true,
        hourly_rate_video: true,
        rating: true,
        total_review: true,
        interests: true,
        relationshipStatus: true,
        career: true,
        education: true,
        sendMailNoti: true,
        sendSMSNoti: true,
        sendPushNoti: true,
        defaultLanguage: true,
        defaultTheme: true,
        twofactorEnabled: true,
        status: true,
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
        ModelService: {
          where: {
            status: "active",
          },
          select: {
            id: true,
            customRate: true,
            customHourlyRate: true,
            customOneTimePrice: true,
            customOneNightPrice: true,
            isAvailable: true,
            minSessionDuration: true,
            maxSessionDuration: true,
            service: {
              select: {
                id: true,
                name: true,
                description: true,
                baseRate: true,
                billingType: true,
                hourlyRate: true,
                oneTimePrice: true,
                oneNightPrice: true,
              },
            },
          },
        },
        _count: {
          select: {
            model_interactions: true,
            friend_contacts: true,
          },
        },
      },
    });

    if (!model) {
      const error = new Error("The model does not exist!") as any;
      error.status = 404;
      throw error;
    }

    // Get LIKE counts and friends count
    const [likeCount, friendsCount] = await Promise.all([
      prisma.customer_interactions.count({
        where: {
          modelId,
          action: "LIKE",
        },
      }),
      prisma.friend_contacts.count({
        where: {
          modelId,
        },
      }),
    ]);

    return {
      ...model,
      totalLikes: likeCount,
      totalFriends: friendsCount,
    };
  } catch (error) {
    console.error("GET_MODEL_OWN_PROFILE_FAILED", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to get model profile information!",
    });
  }
}

// Update model profile
export async function updateModelProfile(
  modelId: string,
  data: IModelProfileCredentials
) {
  if (!modelId)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing model id!",
    });

  const auditBase = {
    action: "UPDATE_MODEL_PROFILE",
    model: modelId,
  };

  try {
    const model = await prisma.model.findUnique({
      where: {
        id: modelId,
      },
    });

    if (!model) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The model does not exist!",
      });
    }

    const updateModel = await prisma.model.update({
      where: { id: modelId },
      data: {
        firstName: data.firstName,
        lastName: data.lastName,
        dob: new Date(data.dob),
        gender: data.gender,
        whatsapp: +data.whatsapp,
        address: data.address,
        relationshipStatus: data.relationshipStatus,
        bio: data.bio,
        career: data.career,
        education: data.education,
        profile: data.profile,
        interests: data.interests,
        available_status: data.available_status,
      },
    });

    if (updateModel.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update model: ${updateModel.id} profile successfully.`,
        status: "success",
        onSuccess: updateModel,
      });
    }

    return updateModel;
  } catch (error: any) {
    console.error("UPDATE_MODEL_PROFILE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update model profile failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to update model profile!",
    });
  }
}

// Insert model image
export async function createModelImage(modelId: string, image: string) {
  if (!modelId)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing model id!",
    });

  const auditBase = {
    action: "CREATE_MODEL_IMAGES",
    model: modelId,
  };

  try {
    const createImage = await prisma.images.create({
      data: {
        name: image,
        status: "active",
        modelId,
      },
    });

    if (createImage.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create model: ${createImage.id} image successfully.`,
        status: "success",
        onSuccess: createImage,
      });
    }

    return createImage;
  } catch (error: any) {
    console.error("CREATE_MODEL_IMAGE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Create model image failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to create model image!",
    });
  }
}

// Update model image with ID
export async function updateModelImage(
  id: string,
  modelId: string,
  image: string
) {
  if (!modelId)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing model id!",
    });

  const auditBase = {
    action: "UPDATE_MODEL_IMAGE",
    model: modelId,
  };

  try {
    const modelImage = await prisma.images.findUnique({
      where: {
        id,
        modelId,
      },
    });

    if (!modelImage) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The image does not exist!",
      });
    }

    const updateImage = await prisma.images.update({
      where: {
        id: modelImage.id,
      },
      data: {
        name: image,
      },
    });

    if (updateImage.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update model: ${updateImage.id} image successfully.`,
        status: "success",
        onSuccess: updateImage,
      });
    }
    return updateImage;
  } catch (error: any) {
    console.error("UPDATE_MODEL_IMAGE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update model image failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to update model image!",
    });
  }
}

// Delete model image
export async function deleteModelImage(id: string, modelId: string) {
  if (!modelId || !id)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing model id or image id!",
    });

  const auditBase = {
    action: "DELETE_MODEL_IMAGE",
    model: modelId,
  };

  try {
    const modelImage = await prisma.images.findUnique({
      where: {
        id,
        modelId,
      },
    });

    if (!modelImage) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The image does not exist!",
      });
    }

    const deleteImage = await prisma.images.update({
      where: {
        id: modelImage.id,
      },
      data: {
        status: "inactive",
      },
    });

    if (deleteImage.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Delete model image: ${deleteImage.id} successfully.`,
        status: "success",
        onSuccess: deleteImage,
      });
    }
    return deleteImage;
  } catch (error: any) {
    console.error("DELETE_MODEL_IMAGE_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Delete model image failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to delete model image!",
    });
  }
}

// Update model setting
export async function updateModelSetting(
  modelId: string,
  data: IModelSettingCredentials
) {
  if (!modelId)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing model id!",
    });

  const auditBase = {
    action: "UPDATE_MODEL_PROFILE_SETTING",
    model: modelId,
  };

  try {
    const model = await prisma.model.findUnique({
      where: {
        id: modelId,
      },
    });

    if (!model) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The model does not exist!",
      });
    }

    const updateModel = await prisma.model.update({
      where: { id: modelId },
      data: {
        twofactorEnabled: data.twofactorEnabled,
        defaultLanguage: data.defaultLanguage,
        defaultTheme: data.defaultTheme,
        sendMailNoti: data.notifications_email,
        sendPushNoti: data.notifications_push,
        sendSMSNoti: data.notifications_sms,
      },
    });

    if (updateModel.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update model: ${updateModel.id} profile setting successfully.`,
        status: "success",
        onSuccess: updateModel,
      });
    }

    return updateModel;
  } catch (error: any) {
    console.error("UPDATE_MODEL_PROFILE_SETTING_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update model profile setting failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to update model profile setting!",
    });
  }
}

// Update chat profile (sync with chat backend)
export async function updateModelChatProfile(
  authToken: string,
  data: {
    phone_number: string;
    first_name: string;
    last_name: string;
    profile_image: string;
  }
) {
  const url = `${process.env.VITE_API_URL}update-profile`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        phone_number: data.phone_number,
        first_name: data.first_name,
        last_name: data.last_name,
        profile_image: data.profile_image,
      }),
    });

    const result = await response.json();

    if (!result.success) {
      console.error("Failed to update model chat profile:", result.message);
      return { success: false, message: result.message };
    }

    console.log("Model chat profile updated successfully");
    return { success: true, data: result.data };
  } catch (error) {
    console.error("Error updating model chat profile:", error);
    return {
      success: false,
      message:
        error instanceof Error
          ? error.message
          : "Failed to update model chat profile",
    };
  }
}

// ============ BANK FUNCTIONS ============

// Get model banks
export async function getModelBanks(modelId: string) {
  if (!modelId) throw new Error("Missing model id!");

  try {
    const banks = await prisma.banks.findMany({
      where: {
        modelId,
        status: "active",
      },
      select: {
        id: true,
        bank_name: true,
        bank_account_name: true,
        bank_account_number: true,
        qr_code: true,
        status: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return banks;
  } catch (error) {
    console.error("GET_MODEL_BANKS_FAILED", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to get model banks!",
    });
  }
}

// Create model bank
export async function createModelBank(
  modelId: string,
  data: {
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    qr_code?: string;
  }
) {
  if (!modelId)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing model id!",
    });

  const auditBase = {
    action: "CREATE_MODEL_BANK",
    model: modelId,
  };

  try {
    const createBank = await prisma.banks.create({
      data: {
        bank_name: data.bank_name,
        bank_account_name: data.bank_account_name,
        bank_account_number: data.bank_account_number,
        qr_code: data.qr_code,
        status: "active",
        modelId,
      },
    });

    if (createBank.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Create model bank: ${createBank.id} successfully.`,
        status: "success",
        onSuccess: createBank,
      });
    }

    return createBank;
  } catch (error: any) {
    console.error("CREATE_MODEL_BANK_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Create model bank failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message:
        error.code === "P2002"
          ? "Bank account already exists!"
          : "Failed to create model bank!",
    });
  }
}

// Update model bank
export async function updateModelBank(
  id: string,
  modelId: string,
  data: {
    bank_name: string;
    bank_account_name: string;
    bank_account_number: string;
    qr_code?: string;
  }
) {
  if (!modelId || !id)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing model id or bank id!",
    });

  const auditBase = {
    action: "UPDATE_MODEL_BANK",
    model: modelId,
  };

  try {
    const bank = await prisma.banks.findUnique({
      where: {
        id,
        modelId,
      },
    });

    if (!bank) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The bank does not exist!",
      });
    }

    const updateBank = await prisma.banks.update({
      where: { id },
      data: {
        bank_name: data.bank_name,
        bank_account_name: data.bank_account_name,
        bank_account_number: data.bank_account_number,
        qr_code: data.qr_code,
      },
    });

    if (updateBank.id) {
      await createAuditLogs({
        ...auditBase,
        description: `Update model bank: ${updateBank.id} successfully.`,
        status: "success",
        onSuccess: updateBank,
      });
    }

    return updateBank;
  } catch (error: any) {
    console.error("UPDATE_MODEL_BANK_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Update model bank failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message:
        error.code === "P2002"
          ? "Bank account already exists!"
          : "Failed to update model bank!",
    });
  }
}

// Delete model bank
export async function deleteModelBank(id: string, modelId: string) {
  if (!modelId || !id)
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Missing model id or bank id!",
    });

  const auditBase = {
    action: "DELETE_MODEL_BANK",
    model: modelId,
  };

  try {
    const bank = await prisma.banks.findUnique({
      where: {
        id,
        modelId,
      },
    });

    if (!bank) {
      throw new FieldValidationError({
        success: false,
        error: true,
        message: "The bank does not exist!",
      });
    }

    // Hard delete to free up unique constraints (bank_account_name, bank_account_number)
    // This allows the model to re-add the same bank account later if needed
    const deletedBank = await prisma.banks.delete({
      where: { id },
    });

    await createAuditLogs({
      ...auditBase,
      description: `Delete model bank: ${deletedBank.id} successfully.`,
      status: "success",
      onSuccess: deletedBank,
    });

    return deletedBank;
  } catch (error: any) {
    console.error("DELETE_MODEL_BANK_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: `Delete model bank failed!`,
      status: "failed",
      onError: error,
    });
    throw new FieldValidationError({
      success: false,
      error: true,
      message: "Failed to delete model bank!",
    });
  }
}

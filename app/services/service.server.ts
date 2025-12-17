import { prisma } from "./database.server";
import { FieldValidationError } from "./base.server";

// Get all services with model's application status
export async function getServicesForModel(modelId: string) {
  try {
    const services = await prisma.service.findMany({
      where: {
        status: "active",
      },
      orderBy: {
        order: "asc",
      },
    });

    const modelServices = await prisma.model_service.findMany({
      where: {
        modelId,
        status: "active",
      },
      include: {
        service: true,
      },
    });

    const appliedServiceMap = new Map(
      modelServices.map((ms) => [ms.serviceId, ms])
    );

    // Combine data
    const servicesWithStatus = services.map((service) => {
      const modelService = appliedServiceMap.get(service.id);
      return {
        ...service,
        isApplied: !!modelService,
        modelServiceId: modelService?.id || null,
        customRate: modelService?.customRate || null,
        isAvailable: modelService?.isAvailable || true,
      };
    });

    return servicesWithStatus;
  } catch (error: any) {
    console.error("GET_SERVICES_FOR_MODEL_ERROR:", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to fetch services!",
    });
  }
}

// Apply for a service
export async function applyForService(
  modelId: string,
  serviceId: string,
  customRate: number
) {
  try {
    // Check if already applied
    const existing = await prisma.model_service.findFirst({
      where: {
        modelId,
        serviceId,
        status: "active",
      },
    });

    if (existing) {
      return {
        success: false,
        error: true,
        message: "You have already applied for this service!",
      };
    }

    // Verify service exists
    const service = await prisma.service.findUnique({
      where: { id: serviceId },
    });

    if (!service) {
      return {
        success: false,
        error: true,
        message: "Service not found!",
      };
    }

    // Create application with custom rate
    await prisma.model_service.create({
      data: {
        modelId,
        serviceId,
        customRate: customRate,
        isAvailable: true,
        status: "active",
      },
    });

    return {
      success: true,
      error: false,
      message: "Successfully applied for service!",
    };
  } catch (error: any) {
    console.error("APPLY_FOR_SERVICE_ERROR:", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to apply for service!",
    });
  }
}

// Cancel service application
export async function cancelServiceApplication(
  modelId: string,
  serviceId: string
) {
  try {
    // Find the model service
    const modelService = await prisma.model_service.findFirst({
      where: {
        modelId,
        serviceId,
        status: "active",
      },
    });

    if (!modelService) {
      return {
        success: false,
        error: true,
        message: "Service application not found!",
      };
    }

    // Delete the application
    await prisma.model_service.delete({
      where: {
        id: modelService.id,
      },
    });

    return {
      success: true,
      error: false,
      message: "Service application cancelled!",
    };
  } catch (error: any) {
    console.error("CANCEL_SERVICE_APPLICATION_ERROR:", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to cancel application!",
    });
  }
}

// Update service application (edit custom rate)
export async function updateServiceApplication(
  modelId: string,
  serviceId: string,
  modelServiceId: string,
  customRate: number
) {
  try {
    // Verify the model service exists and belongs to this model
    const modelService = await prisma.model_service.findFirst({
      where: {
        id: modelServiceId,
        modelId,
        serviceId,
        status: "active",
      },
    });

    if (!modelService) {
      return {
        success: false,
        error: true,
        message: "Service application not found!",
      };
    }

    // Update the custom rate
    await prisma.model_service.update({
      where: {
        id: modelServiceId,
      },
      data: {
        customRate: customRate,
      },
    });

    return {
      success: true,
      error: false,
      message: "Service rate updated successfully!",
    };
  } catch (error: any) {
    console.error("UPDATE_SERVICE_APPLICATION_ERROR:", error);
    throw new FieldValidationError({
      success: false,
      error: true,
      message: error.message || "Failed to update service rate!",
    });
  }
}

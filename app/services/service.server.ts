import { prisma } from "./database.server";
import { FieldValidationError } from "./base.server";

// Get all active services for public display (home page)
export async function getPublicServices() {
  try {
    const services = await prisma.service.findMany({
      where: {
        status: "active",
      },
      orderBy: {
        order: "asc",
      },
      select: {
        id: true,
        name: true,
        description: true,
      },
    });

    return services;
  } catch (error: any) {
    console.error("GET_PUBLIC_SERVICES_ERROR:", error);
    return [];
  }
}

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
      select: {
        id: true,
        name: true,
        description: true,
        baseRate: true,
        commission: true,
        status: true,
        billingType: true,
        hourlyRate: true,
        oneTimePrice: true,
        oneNightPrice: true,
      },
    });

    const modelServices = await prisma.model_service.findMany({
      where: {
        modelId,
        status: "active",
      },
      include: {
        service: true,
        model_service_variant: {
          where: {
            status: "active",
          },
          select: {
            id: true,
            name: true,
            pricePerHour: true,
          },
        },
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
        customHourlyRate: modelService?.customHourlyRate || null,
        customOneTimePrice: modelService?.customOneTimePrice || null,
        customOneNightPrice: modelService?.customOneNightPrice || null,
        isAvailable: modelService?.isAvailable || true,
        massageVariants: modelService?.model_service_variant || [],
        serviceLocation: modelService?.serviceLocation || null,
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
export interface ServiceRates {
  customRate?: number;
  customHourlyRate?: number;
  customOneTimePrice?: number;
  customOneNightPrice?: number;
}

export interface MassageVariant {
  name: string;
  pricePerHour: number;
}

export async function applyForService(
  modelId: string,
  serviceId: string,
  rates: ServiceRates,
  massageVariants?: MassageVariant[],
  serviceLocation?: string
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

    // Check if massage service requires variants and location
    if (service.name.toLowerCase() === "massage") {
      if (!massageVariants || massageVariants.length === 0) {
        return {
          success: false,
          error: true,
          message: "At least one massage type is required for massage service!",
        };
      }
      if (!serviceLocation || serviceLocation.trim() === "") {
        return {
          success: false,
          error: true,
          message: "Service location is required for massage service!",
        };
      }
    }

    // Create application with custom rates based on billing type
    const modelService = await prisma.model_service.create({
      data: {
        modelId,
        serviceId,
        customRate: rates.customRate ?? null,
        customHourlyRate: rates.customHourlyRate ?? null,
        customOneTimePrice: rates.customOneTimePrice ?? null,
        customOneNightPrice: rates.customOneNightPrice ?? null,
        serviceLocation: serviceLocation ?? null,
        isAvailable: true,
        status: "active",
      },
    });

    // If massage service, create variants
    if (service.name.toLowerCase() === "massage" && massageVariants && massageVariants.length > 0) {
      await prisma.model_service_variant.createMany({
        data: massageVariants.map(variant => ({
          modelServiceId: modelService.id,
          name: variant.name,
          pricePerHour: variant.pricePerHour,
          status: "active",
        })),
      });
    }

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
  rates: ServiceRates,
  massageVariants?: MassageVariant[],
  serviceLocation?: string
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
      include: {
        service: true,
      },
    });

    if (!modelService) {
      return {
        success: false,
        error: true,
        message: "Service application not found!",
      };
    }

    // Check if massage service requires variants and location
    if (modelService.service?.name.toLowerCase() === "massage") {
      if (!massageVariants || massageVariants.length === 0) {
        return {
          success: false,
          error: true,
          message: "At least one massage type is required for massage service!",
        };
      }
      if (!serviceLocation || serviceLocation.trim() === "") {
        return {
          success: false,
          error: true,
          message: "Service location is required for massage service!",
        };
      }
    }

    // Update the custom rates and service location
    await prisma.model_service.update({
      where: {
        id: modelServiceId,
      },
      data: {
        customRate: rates.customRate ?? modelService.customRate,
        customHourlyRate: rates.customHourlyRate ?? modelService.customHourlyRate,
        customOneTimePrice: rates.customOneTimePrice ?? modelService.customOneTimePrice,
        customOneNightPrice: rates.customOneNightPrice ?? modelService.customOneNightPrice,
        serviceLocation: serviceLocation ?? modelService.serviceLocation,
      },
    });

    // If massage service, update variants
    if (modelService.service?.name.toLowerCase() === "massage" && massageVariants && massageVariants.length > 0) {
      // Delete existing variants
      await prisma.model_service_variant.deleteMany({
        where: {
          modelServiceId: modelServiceId,
        },
      });

      // Create new variants
      await prisma.model_service_variant.createMany({
        data: massageVariants.map(variant => ({
          modelServiceId: modelServiceId,
          name: variant.name,
          pricePerHour: variant.pricePerHour,
          status: "active",
        })),
      });
    }

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

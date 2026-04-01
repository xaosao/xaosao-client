import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { requireModelSession } from "~/services/model-auth.server";
import { prisma } from "~/services/database.server";
import { uploadFileToBunnyServer, deleteFileFromBunny, resolveUserUploadPath } from "~/services/upload.server";
import { createModelImage } from "~/services/model-profile.server";
import { extractFilenameFromCDNSafe } from "~/utils/functions/textFormat";

/**
 * Check if model's profile/gallery images are accessible (not 404)
 */
async function checkImageUrl(url: string): Promise<boolean> {
  try {
    const res = await fetch(url, { method: "HEAD", signal: AbortSignal.timeout(5000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);

  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      profile: true,
      profileHiddenByAdmin: true,
      Images: {
        where: { status: "active" },
        select: { id: true, name: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!model) return { needsAttention: false };

  // Check profile image
  let profileOk = true;
  if (model.profile) {
    profileOk = await checkImageUrl(model.profile);
  } else {
    profileOk = false; // No profile image at all
  }

  // Check gallery images
  const galleryResults = await Promise.all(
    model.Images.map(async (img) => ({
      id: img.id,
      name: img.name,
      ok: await checkImageUrl(img.name),
    }))
  );

  const brokenGalleryImages = galleryResults.filter((r) => !r.ok);
  const galleryCount = model.Images.length;
  const needsMoreImages = galleryCount < 6;

  const profileHiddenByAdmin = !!model.profileHiddenByAdmin;
  const needsAttention = !profileOk || brokenGalleryImages.length > 0 || needsMoreImages || profileHiddenByAdmin;

  return {
    needsAttention,
    profileOk,
    profileUrl: model.profile,
    profileHiddenByAdmin,
    galleryImages: galleryResults,
    galleryCount,
    brokenGalleryImages: brokenGalleryImages.map((r) => r.id),
    needsMoreImages,
    modelName: `${model.firstName} ${model.lastName || ""}`.trim(),
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();
  const intent = formData.get("intent") as string;

  // Upload profile image
  if (intent === "uploadProfile") {
    const file = formData.get("file") as File;
    const oldProfile = formData.get("oldProfile") as string | null;

    if (!file || !(file instanceof File) || file.size === 0) {
      return { error: "No file provided" };
    }

    try {
      const folderPath = await resolveUserUploadPath("model", modelId, "avatar");
      const buffer = Buffer.from(await file.arrayBuffer());
      const url = await uploadFileToBunnyServer(buffer, file.name, file.type, folderPath, "avatar");

      await prisma.model.update({
        where: { id: modelId },
        data: { profile: url, profileHiddenByAdmin: false },
      });

      // Delete old profile from CDN
      if (oldProfile) {
        deleteFileFromBunny(extractFilenameFromCDNSafe(oldProfile)).catch(() => {});
      }

      return { success: true, intent: "uploadProfile", url };
    } catch (e: any) {
      return { error: e.message || "Failed to upload profile image" };
    }
  }

  // Upload gallery image
  if (intent === "uploadGallery") {
    const file = formData.get("file") as File;

    if (!file || !(file instanceof File) || file.size === 0) {
      return { error: "No file provided" };
    }

    try {
      const folderPath = await resolveUserUploadPath("model", modelId, "gallery");
      const buffer = Buffer.from(await file.arrayBuffer());
      const url = await uploadFileToBunnyServer(buffer, file.name, file.type, folderPath, "gallery");
      const record = await createModelImage(modelId, url);

      return { success: true, intent: "uploadGallery", url, imageId: record.id };
    } catch (e: any) {
      return { error: e.message || "Failed to upload gallery image" };
    }
  }

  return { error: "Invalid intent" };
}

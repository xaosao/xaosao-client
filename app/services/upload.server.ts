import sharp from "sharp";
import { prisma } from "./database.server";

/**
 * Check if file is WebP format based on content type or filename
 */
function isWebpFile(fileName: string, contentType: string): boolean {
  return (
    contentType === "image/webp" ||
    fileName.toLowerCase().endsWith(".webp")
  );
}

/**
 * Convert WebP image to JPEG using sharp
 */
async function convertWebpToJpeg(
  buffer: Buffer,
  quality: number = 85
): Promise<Buffer> {
  console.log("[Server] Converting WebP to JPEG...");
  const jpegBuffer = await sharp(buffer)
    .jpeg({ quality })
    .toBuffer();
  console.log("[Server] WebP converted to JPEG:", jpegBuffer.length, "bytes");
  return jpegBuffer;
}

/**
 * Get file extension from content type or filename
 */
function getFileExtension(fileName: string, contentType: string): string {
  const extFromName = fileName.toLowerCase().split(".").pop();
  if (extFromName && ["jpg", "jpeg", "png", "gif", "pdf"].includes(extFromName)) {
    return extFromName === "jpeg" ? "jpg" : extFromName;
  }
  const typeMap: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "application/pdf": "pdf",
  };
  return typeMap[contentType] || "jpg";
}

// Upload file type prefixes for generated file names
export type UploadFileType = "avatar" | "gallery" | "qr" | "post" | "slip";

/**
 * Build the user folder path for BunnyCDN uploads.
 *
 * Structure:
 *   {prefix}-{userId}-{firstName}/{subfolder}/
 *
 * Examples:
 *   m-69b621bad30ef86cac335a3a-paokue/profile/
 *   c-69b621bad30ef86cac335a3a-paokue/payment-slip/
 */
export function getUserUploadPath(
  userType: "model" | "customer",
  userId: string,
  firstName: string,
  fileType: UploadFileType,
  whatsapp?: number
): string {
  const prefix = userType === "model" ? "m" : "c";
  const latinOnly = firstName.toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 20);
  const safeName = latinOnly || (whatsapp ? String(whatsapp).slice(0, -3) : "user");
  const userFolder = `${prefix}-${userId}-${safeName}`;

  const subfolderMap: Record<UploadFileType, string> = {
    avatar: "profile",
    gallery: "profile/gallery",
    qr: "qr-code",
    post: "posts",
    slip: "payment-slip",
  };

  return `${userFolder}/${subfolderMap[fileType]}`;
}

/**
 * Upload a file to BunnyCDN.
 *
 * @param fileBuffer - The file buffer to upload
 * @param fileName - Original file name (used for extension detection)
 * @param contentType - MIME type
 * @param folderPath - Optional folder path within the storage zone (e.g., "c-abc123-john/profile")
 * @param filePrefix - Optional prefix for the generated filename (e.g., "avatar", "gallery", "slip")
 */
export async function uploadFileToBunnyServer(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = "application/octet-stream",
  folderPath?: string,
  filePrefix?: string
): Promise<string> {
  const STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE || "";
  const ACCESS_KEY = process.env.BUNNY_API_KEY || "";
  const BASE_HOSTNAME =
    process.env.BUNNY_BASE_HOSTNAME || "storage.bunnycdn.com";

  let processedBuffer = fileBuffer;
  let processedFileName = fileName;
  let processedContentType = contentType;

  // Convert WebP to JPEG on server side
  if (isWebpFile(fileName, contentType)) {
    try {
      processedBuffer = await convertWebpToJpeg(fileBuffer);
      processedFileName = fileName.replace(/\.webp$/i, ".jpg");
      processedContentType = "image/jpeg";
      console.log("[Server] WebP file converted:", processedFileName);
    } catch (error) {
      console.error("[Server] WebP conversion failed:", error);
    }
  }

  const timestamp = Date.now();
  const ext = getFileExtension(processedFileName, processedContentType);

  // Build the file name: either prefixed (e.g., avatar-1710729600.jpg) or legacy (timestamp-originalname)
  let uniqueFileName: string;
  if (filePrefix) {
    uniqueFileName = `${filePrefix}-${timestamp}.${ext}`;
  } else {
    uniqueFileName = `${timestamp}-${processedFileName}`;
  }

  // Build the full path within the storage zone
  const storagePath = folderPath
    ? `${folderPath}/${uniqueFileName}`
    : uniqueFileName;

  const endpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE_NAME}/${storagePath}`;

  console.log("[BunnyCDN UPLOAD]", endpoint);

  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        AccessKey: ACCESS_KEY,
        "Content-Type": processedContentType,
        "Content-Length": processedBuffer.length.toString(),
      },
      body: new Uint8Array(processedBuffer),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Upload failed with status ${response.status}: ${errorText}`
      );
    }

    const cdnHostname =
      process.env.BUNNY_CDN_HOST || `https://${STORAGE_ZONE_NAME}.b-cdn.net`;
    return `${cdnHostname}/${storagePath}`;
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}

/**
 * Resolve the upload folder path by fetching the user's firstName from DB.
 * Returns the folder path string for use with uploadFileToBunnyServer.
 */
export async function resolveUserUploadPath(
  userType: "model" | "customer",
  userId: string,
  fileType: UploadFileType
): Promise<string> {
  let firstName = "user";
  let whatsapp: number | undefined;
  try {
    if (userType === "customer") {
      const customer = await prisma.customer.findUnique({
        where: { id: userId },
        select: { firstName: true, whatsapp: true },
      });
      if (customer?.firstName) firstName = customer.firstName;
      if (customer?.whatsapp) whatsapp = customer.whatsapp;
    } else {
      const model = await prisma.model.findUnique({
        where: { id: userId },
        select: { firstName: true, whatsapp: true },
      });
      if (model?.firstName) firstName = model.firstName;
      if (model?.whatsapp) whatsapp = model.whatsapp;
    }
  } catch (error) {
    console.error("[Upload] Failed to fetch user name for folder path:", error);
  }
  return getUserUploadPath(userType, userId, firstName, fileType, whatsapp);
}

/**
 * Migrate a flat-uploaded profile image to the structured folder after registration.
 * Downloads the flat file, re-uploads to the user folder, updates DB, deletes old file.
 *
 * @param userType - "model" or "customer"
 * @param whatsapp - The user's whatsapp number (used to look up the newly created user)
 * @param oldProfileUrl - The flat CDN URL of the profile image
 */
export async function migrateProfileToStructuredFolder(
  userType: "model" | "customer",
  whatsapp: number,
  oldProfileUrl?: string
): Promise<void> {
  if (!oldProfileUrl) return;

  // Check if already migrated
  if (/\/[mc]-[a-f0-9]{24}-[a-z0-9]+\//.test(oldProfileUrl)) return;

  const STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE || "";
  const ACCESS_KEY = process.env.BUNNY_API_KEY || "";
  const BASE_HOSTNAME = process.env.BUNNY_BASE_HOSTNAME || "storage.bunnycdn.com";

  // Find the user by whatsapp
  let userId: string | undefined;
  let firstName = "user";

  if (userType === "model") {
    const model = await prisma.model.findFirst({
      where: { whatsapp },
      select: { id: true, firstName: true },
    });
    if (!model) return;
    userId = model.id;
    firstName = model.firstName || "user";
  } else {
    const customer = await prisma.customer.findFirst({
      where: { whatsapp },
      select: { id: true, firstName: true },
    });
    if (!customer) return;
    userId = customer.id;
    firstName = customer.firstName || "user";
  }

  // Extract old file path from URL
  let oldPath: string;
  try {
    const parsed = new URL(oldProfileUrl);
    oldPath = parsed.pathname.substring(1);
  } catch {
    oldPath = oldProfileUrl;
  }

  // Download old file
  const downloadEndpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE_NAME}/${oldPath}`;
  const response = await fetch(downloadEndpoint, { headers: { AccessKey: ACCESS_KEY } });
  if (!response.ok) {
    console.error(`[Migration] Failed to download old profile: ${oldPath}`);
    return;
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  const contentType = response.headers.get("content-type") || "image/jpeg";

  // Upload to structured folder
  const folderPath = getUserUploadPath(userType, userId, firstName, "avatar", whatsapp);
  const ext = oldPath.match(/\.(\w+)$/)?.[1] || "jpg";
  const newUrl = await uploadFileToBunnyServer(buffer, `profile.${ext}`, contentType, folderPath, "avatar");

  // Update database
  if (userType === "model") {
    await prisma.model.update({ where: { id: userId }, data: { profile: newUrl } });
  } else {
    await prisma.customer.update({ where: { id: userId }, data: { profile: newUrl } });
  }

  // Delete old flat file (non-blocking)
  const deleteEndpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE_NAME}/${oldPath}`;
  fetch(deleteEndpoint, { method: "DELETE", headers: { AccessKey: ACCESS_KEY } }).catch(() => {});

  console.log(`[Migration] Profile migrated: ${oldPath} → ${folderPath}/`);
}

export async function deleteFileFromBunny(filePath: string): Promise<boolean> {
  if (!filePath) return false;

  const STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE || "";
  const ACCESS_KEY = process.env.BUNNY_API_KEY || "";
  const BASE_HOSTNAME =
    process.env.BUNNY_BASE_HOSTNAME || "storage.bunnycdn.com";

  const endpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE_NAME}/${filePath}`;

  console.log(`[BunnyCDN DELETE] Deleting file: ${filePath} | Endpoint: ${endpoint} | Time: ${new Date().toISOString()}`);

  try {
    const response = await fetch(endpoint, {
      method: "DELETE",
      headers: {
        AccessKey: ACCESS_KEY,
      },
    });

    if (response.ok) {
      console.log(`[BunnyCDN DELETE] SUCCESS: ${filePath}`);
    } else {
      console.error(`[BunnyCDN DELETE] FAILED: ${filePath} | Status: ${response.status}`);
    }

    return response.ok;
  } catch (error) {
    console.error(`[BunnyCDN DELETE] ERROR: ${filePath}`, error);
    return false;
  }
}

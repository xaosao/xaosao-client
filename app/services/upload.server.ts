import sharp from "sharp";

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

export async function uploadFileToBunnyServer(
  fileBuffer: Buffer,
  fileName: string,
  contentType: string = "application/octet-stream"
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
      // Continue with original file if conversion fails
    }
  }

  const timestamp = Date.now();
  const uniqueFileName = `${timestamp}-${processedFileName}`;
  const endpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE_NAME}/${uniqueFileName}`;

  console.log(
    "Uploading:::",
    `https://${BASE_HOSTNAME}/${STORAGE_ZONE_NAME}/${uniqueFileName}`
  );

  try {
    const response = await fetch(endpoint, {
      method: "PUT",
      headers: {
        AccessKey: ACCESS_KEY,
        "Content-Type": processedContentType,
        "Content-Length": processedBuffer.length.toString(),
      },
      body: processedBuffer,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `Upload failed with status ${response.status}: ${errorText}`
      );
    }

    const cdnHostname =
      process.env.BUNNY_CDN_HOST || `https://${STORAGE_ZONE_NAME}.b-cdn.net`;
    return `${cdnHostname}/${uniqueFileName}`;
  } catch (error) {
    console.error("Upload error:", error);
    throw error;
  }
}

export async function deleteFileFromBunny(filePath: string): Promise<boolean> {
  const STORAGE_ZONE_NAME = process.env.BUNNY_STORAGE_ZONE || "";
  const ACCESS_KEY = process.env.BUNNY_API_KEY || "";
  const BASE_HOSTNAME =
    process.env.BUNNY_BASE_HOSTNAME || "storage.bunnycdn.com";

  const endpoint = `https://${BASE_HOSTNAME}/${STORAGE_ZONE_NAME}/${filePath}`;

  const response = await fetch(endpoint, {
    method: "DELETE",
    headers: {
      AccessKey: ACCESS_KEY,
    },
  });

  return response.ok;
}

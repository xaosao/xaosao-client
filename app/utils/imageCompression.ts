/**
 * Compress an image file to reduce its size before upload
 * This helps avoid Vercel's 4.5MB body size limit
 * Supports HEIC/HEIF files (common on iOS devices)
 * WebP files are NOT supported - users must use JPG or PNG
 */

export interface CompressOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  maxSizeMB?: number;
}

const defaultOptions: CompressOptions = {
  maxWidth: 1920,
  maxHeight: 1920,
  quality: 0.8,
  maxSizeMB: 3,
};

/**
 * Check if a file is HEIC/HEIF format
 */
function isHeicFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return (
    type === 'image/heic' ||
    type === 'image/heif' ||
    name.endsWith('.heic') ||
    name.endsWith('.heif')
  );
}

/**
 * Check if a file is WebP format
 */
function isWebpFile(file: File): boolean {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();
  return type === 'image/webp' || name.endsWith('.webp');
}

/**
 * Convert HEIC/HEIF file to JPEG
 * Uses dynamic import to avoid SSR issues (heic2any requires browser APIs)
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    const heic2any = (await import('heic2any')).default;

    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });

    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

    const newFileName = file.name.replace(/\.(heic|heif)$/i, '.jpg');
    return new File([blob], newFileName, {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('HEIC conversion failed:', error);
    throw new Error('Could not convert HEIC image. Please use a different format.');
  }
}

/**
 * Compress an image file
 * @param file - The image file to compress
 * @param options - Compression options
 * @returns A promise that resolves to the compressed file
 */
export async function compressImage(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  const opts = { ...defaultOptions, ...options };
  console.log('[Compress] Starting:', file.name, file.type, file.size);

  let processedFile = file;

  // Convert HEIC/HEIF files to JPEG first
  if (isHeicFile(file)) {
    console.log('[Compress] Converting HEIC to JPEG');
    processedFile = await convertHeicToJpeg(file);
  }
  // Block WebP files - not supported
  else if (isWebpFile(file)) {
    console.error('[Compress] WebP files are not supported');
    throw new Error('WebP format is not supported. Please use JPG or PNG instead.');
  }

  console.log('[Compress] After format conversion:', processedFile.name, processedFile.type, processedFile.size);

  // If file is already small enough, return as-is
  const maxSizeBytes = (opts.maxSizeMB || 2) * 1024 * 1024;
  if (processedFile.size <= maxSizeBytes) {
    console.log('[Compress] File small enough, returning as-is');
    return processedFile;
  }

  // File needs compression - resize and compress
  console.log('[Compress] File too large, compressing...');
  return compressWithCanvas(processedFile, opts, maxSizeBytes);
}

/**
 * Compress image using canvas
 */
async function compressWithCanvas(
  file: File,
  opts: CompressOptions,
  maxSizeBytes: number,
  attempt: number = 1
): Promise<File> {
  const MAX_ATTEMPTS = 8;

  return new Promise((resolve, reject) => {
    const blobUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      try {
        // Calculate new dimensions - reduce more aggressively on each attempt
        let width = img.width;
        let height = img.height;
        const scaleFactor = Math.max(0.5, 1 - (attempt - 1) * 0.1); // Reduce dimensions on retries
        const maxW = Math.floor((opts.maxWidth || 1920) * scaleFactor);
        const maxH = Math.floor((opts.maxHeight || 1920) * scaleFactor);

        if (width > maxW) {
          height = (height * maxW) / width;
          width = maxW;
        }
        if (height > maxH) {
          width = (width * maxH) / height;
          height = maxH;
        }

        const canvas = document.createElement('canvas');
        canvas.width = Math.floor(width);
        canvas.height = Math.floor(height);

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          URL.revokeObjectURL(blobUrl);
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Fill with white background
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

        // Reduce quality more aggressively on each attempt
        const currentQuality = Math.max(0.3, (opts.quality || 0.8) - (attempt - 1) * 0.1);

        canvas.toBlob(
          (blob) => {
            URL.revokeObjectURL(blobUrl);

            if (!blob) {
              reject(new Error('Could not compress image'));
              return;
            }

            const newFileName = file.name.replace(/\.[^.]+$/, '.jpg');
            const compressedFile = new File([blob], newFileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            console.log(`[Compress] Attempt ${attempt} - Result:`, compressedFile.name, (compressedFile.size / 1024 / 1024).toFixed(2), 'MB', `(quality: ${currentQuality.toFixed(1)}, dims: ${canvas.width}x${canvas.height})`);

            // If still too large and haven't exceeded max attempts, try again
            if (compressedFile.size > maxSizeBytes && attempt < MAX_ATTEMPTS) {
              compressWithCanvas(file, opts, maxSizeBytes, attempt + 1)
                .then(resolve)
                .catch(reject);
            } else if (compressedFile.size > maxSizeBytes) {
              // Max attempts reached but still too large - return anyway with warning
              console.warn(`[Compress] Max attempts reached. Final size: ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB (target: ${(maxSizeBytes / 1024 / 1024).toFixed(2)}MB)`);
              resolve(compressedFile);
            } else {
              resolve(compressedFile);
            }
          },
          'image/jpeg',
          currentQuality
        );
      } catch (error) {
        URL.revokeObjectURL(blobUrl);
        reject(error);
      }
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      reject(new Error('Could not load image for compression'));
    };

    img.src = blobUrl;
  });
}

/**
 * Compress image and return as DataURL for preview
 */
export async function compressImageToDataURL(
  file: File,
  options: CompressOptions = {}
): Promise<string> {
  const compressedFile = await compressImage(file, options);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(compressedFile);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Could not read compressed file'));
  });
}

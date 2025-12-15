/**
 * Compress an image file to reduce its size before upload
 * This helps avoid Vercel's 4.5MB body size limit
 * Supports HEIC/HEIF files (common on iOS devices)
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
  maxSizeMB: 2,
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
 * Convert HEIC/HEIF file to JPEG
 * Uses dynamic import to avoid SSR issues (heic2any requires browser APIs)
 */
async function convertHeicToJpeg(file: File): Promise<File> {
  try {
    // Dynamic import to avoid "window is not defined" error during SSR
    const heic2any = (await import('heic2any')).default;

    const convertedBlob = await heic2any({
      blob: file,
      toType: 'image/jpeg',
      quality: 0.9,
    });

    // heic2any can return a single blob or array of blobs
    const blob = Array.isArray(convertedBlob) ? convertedBlob[0] : convertedBlob;

    // Create a new file with .jpg extension
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

  // Convert HEIC/HEIF files to JPEG first
  let processedFile = file;
  if (isHeicFile(file)) {
    processedFile = await convertHeicToJpeg(file);
  }

  // If file is already small enough, return as-is (or converted HEIC)
  const maxSizeBytes = (opts.maxSizeMB || 2) * 1024 * 1024;
  if (processedFile.size <= maxSizeBytes) {
    return processedFile;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(processedFile);

    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;

      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');

        if (!ctx) {
          reject(new Error('Could not get canvas context'));
          return;
        }

        // Calculate new dimensions while maintaining aspect ratio
        let { width, height } = img;
        const maxW = opts.maxWidth || 1920;
        const maxH = opts.maxHeight || 1920;

        if (width > maxW) {
          height = (height * maxW) / width;
          width = maxW;
        }
        if (height > maxH) {
          width = (width * maxH) / height;
          height = maxH;
        }

        canvas.width = width;
        canvas.height = height;

        // Draw image on canvas
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to blob with quality setting
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              reject(new Error('Could not compress image'));
              return;
            }

            // Create a new file from the blob
            const compressedFile = new File([blob], processedFile.name.replace(/\.[^.]+$/, '.jpg'), {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            // If still too large, try again with lower quality
            if (compressedFile.size > maxSizeBytes && (opts.quality || 0.8) > 0.3) {
              compressImage(processedFile, {
                ...opts,
                quality: (opts.quality || 0.8) - 0.1,
              })
                .then(resolve)
                .catch(reject);
            } else {
              resolve(compressedFile);
            }
          },
          'image/jpeg',
          opts.quality || 0.8
        );
      };

      img.onerror = () => {
        reject(new Error('Could not load image'));
      };
    };

    reader.onerror = () => {
      reject(new Error('Could not read file'));
    };
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

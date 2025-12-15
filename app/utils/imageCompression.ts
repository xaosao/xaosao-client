/**
 * Compress an image file to reduce its size before upload
 * This helps avoid Vercel's 4.5MB body size limit
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

  // If file is already small enough, return as-is
  const maxSizeBytes = (opts.maxSizeMB || 2) * 1024 * 1024;
  if (file.size <= maxSizeBytes) {
    return file;
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);

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
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            // If still too large, try again with lower quality
            if (compressedFile.size > maxSizeBytes && (opts.quality || 0.8) > 0.3) {
              compressImage(file, {
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

// Web image compression utility for better mobile data experience
export const compressImageForWeb = async (file: File, quality: number = 0.5): Promise<File> => {
  return new Promise((resolve) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Calculate dimensions to maintain aspect ratio while reducing size
      const maxWidth = 1200; // Maximum width for challenge photos
      const maxHeight = 1200; // Maximum height for challenge photos
      
      let { width, height } = img;
      
      // Scale down if image is too large
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }
      
      canvas.width = width;
      canvas.height = height;
      
      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });
            resolve(compressedFile);
          } else {
            resolve(file); // Fallback to original if compression fails
          }
        },
        'image/jpeg',
        quality
      );
    };
    
    img.onerror = () => {
      resolve(file); // Fallback to original if loading fails
    };
    
    img.src = URL.createObjectURL(file);
  });
};

// Profile image compression (higher quality)
export const compressProfileImageForWeb = async (file: File): Promise<File> => {
  return compressImageForWeb(file, 0.8);
};

// Challenge photo compression (lower quality for mobile data)
export const compressChallengeImageForWeb = async (file: File): Promise<File> => {
  return compressImageForWeb(file, 0.5);
};
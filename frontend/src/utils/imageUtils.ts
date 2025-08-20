import { Image as RNImage } from 'react-native';

export type ImageAspectRatio = {
  ratio: number;
  type: 'square' | 'vertical' | 'landscape';
};

export const getImageAspectRatio = (imageUri: string): Promise<ImageAspectRatio> => {
  return new Promise((resolve) => {
    RNImage.getSize(
      imageUri,
      (width, height) => {
        const ratio = width / height;
        
        // Determine aspect ratio type based on width/height ratio
        if (ratio >= 0.95 && ratio <= 1.05) {
          // Square: 1:1 (with small tolerance)
          resolve({ ratio: 1, type: 'square' });
        } else if (ratio < 0.95) {
          // Vertical: 4:5 (0.8)
          resolve({ ratio: 4/5, type: 'vertical' });
        } else {
          // Landscape: 1.91:1
          resolve({ ratio: 1.91, type: 'landscape' });
        }
      },
      (error) => {
        // Fallback to square if we can't get dimensions
        resolve({ ratio: 1, type: 'square' });
      }
    );
  });
};

export const getStaticAspectRatio = (type: 'square' | 'vertical' | 'landscape'): number => {
  switch (type) {
    case 'square':
      return 1; // 1:1
    case 'vertical':
      return 4/5; // 4:5
    case 'landscape':
      return 1.91; // 1.91:1
    default:
      return 1;
  }
};
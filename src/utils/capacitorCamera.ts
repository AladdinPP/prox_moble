// Capacitor Camera utility functions
// This file will only be used when building for mobile platforms

export const isCapacitorAvailable = (): boolean => {
  if (typeof window === 'undefined') {
    return false;
  }

  const globalWindow = window as Window & {
    Capacitor?: unknown;
    CapacitorWeb?: unknown;
  };

  return Boolean(
    globalWindow.Capacitor ||
    globalWindow.CapacitorWeb ||
    navigator.userAgent.includes('Capacitor')
  );
};

export const selectImageWithCapacitor = async (): Promise<string | null> => {
  try {
    if (!isCapacitorAvailable()) {
      return null;
    }

    // TODO: Uncomment when building for mobile platforms
    // Dynamic imports to avoid build-time analysis
    // const coreModule = await import('@capacitor/core');
    // const cameraModule = await import('@capacitor/camera');
    
    // const Capacitor = coreModule.Capacitor;
    // const CapacitorCamera = cameraModule.Camera;
    // const CameraResultType = cameraModule.CameraResultType;
    // const CameraSource = cameraModule.CameraSource;

    // if (Capacitor && Capacitor.isNativePlatform()) {
    //   const image = await CapacitorCamera.getPhoto({
    //     quality: 90,
    //     allowEditing: true,
    //     resultType: CameraResultType.DataUrl,
    //     source: CameraSource.Prompt,
    //   });

    //   return image.dataUrl || null;
    // }
  } catch (error) {
    console.log('Capacitor Camera not available:', error);
  }
  
  return null;
};

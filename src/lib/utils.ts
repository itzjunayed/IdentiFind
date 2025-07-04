// src/lib/utils.ts

export const generateId = (): string => {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

export const formatTimestamp = (date: Date | string): string => {
    const d = new Date(date);
    return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
};

export const formatProcessingTime = (milliseconds: number): string => {
    if (milliseconds < 1000) {
        return `${milliseconds}ms`;
    }

    const seconds = Math.floor(milliseconds / 1000);
    const remainingMs = milliseconds % 1000;

    if (seconds < 60) {
        return `${seconds}.${remainingMs.toString().padStart(3, '0').slice(0, 1)}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    return `${minutes}m ${remainingSeconds}s`;
};

export const dataURLtoBlob = (dataURL: string): Blob => {
    const arr = dataURL.split(',');
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);

    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }

    return new Blob([u8arr], { type: mime });
};

export const blobToDataURL = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const resizeImage = (
    canvas: HTMLCanvasElement,
    maxWidth: number = 800,
    maxHeight: number = 600,
    quality: number = 0.8
): string => {
    const originalWidth = canvas.width;
    const originalHeight = canvas.height;

    let { width, height } = calculateDimensions(
        originalWidth,
        originalHeight,
        maxWidth,
        maxHeight
    );

    const resizeCanvas = document.createElement('canvas');
    const ctx = resizeCanvas.getContext('2d')!;

    resizeCanvas.width = width;
    resizeCanvas.height = height;

    ctx.drawImage(canvas, 0, 0, width, height);

    return resizeCanvas.toDataURL('image/jpeg', quality);
};

export const calculateDimensions = (
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
): { width: number; height: number } => {
    let width = originalWidth;
    let height = originalHeight;

    if (width > maxWidth) {
        height = (height * maxWidth) / width;
        width = maxWidth;
    }

    if (height > maxHeight) {
        width = (width * maxHeight) / height;
        height = maxHeight;
    }

    return { width: Math.round(width), height: Math.round(height) };
};

export const debounce = <T extends (...args: any[]) => any>(
    func: T,
    wait: number
): (...args: Parameters<T>) => void => {
    let timeout: NodeJS.Timeout;

    return (...args: Parameters<T>) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(null, args), wait);
    };
};

export const throttle = <T extends (...args: any[]) => any>(
    func: T,
    limit: number
): (...args: Parameters<T>) => void => {
    let inThrottle: boolean;

    return (...args: Parameters<T>) => {
        if (!inThrottle) {
            func.apply(null, args);
            inThrottle = true;
            setTimeout(() => (inThrottle = false), limit);
        }
    };
};

export const playNotificationSound = (): void => {
    try {
        const audio = new Audio('/capture-sound.mp3');
        audio.volume = 0.3;
        audio.play().catch(console.error);
    } catch (error) {
        console.error('Error playing notification sound:', error);
    }
};

export const downloadFile = (data: string, filename: string, type: string = 'text/plain'): void => {
    const blob = new Blob([data], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

export const validateImageFile = (file: File): { valid: boolean; error?: string } => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

    if (!allowedTypes.includes(file.type)) {
        return {
            valid: false,
            error: 'Invalid file type. Please upload a JPEG, PNG, or WebP image.',
        };
    }

    if (file.size > maxSize) {
        return {
            valid: false,
            error: 'File size too large. Please upload an image smaller than 10MB.',
        };
    }

    return { valid: true };
};

export const getErrorMessage = (error: unknown): string => {
    if (error instanceof Error) {
        return error.message;
    }

    if (typeof error === 'string') {
        return error;
    }

    return 'An unknown error occurred';
};
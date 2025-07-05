interface RetryOptions {
  maxRetries?: number;
  baseDelay?: number;
  maxDelay?: number;
  backoffFactor?: number;
}

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<RetryResult<T>> {
  const {
    maxRetries = 3,
    baseDelay = 1000,
    maxDelay = 10000,
    backoffFactor = 2
  } = options;

  let lastError: Error | null = null;
  let attempts = 0;

  for (let i = 0; i <= maxRetries; i++) {
    attempts = i + 1;
    
    try {
      const result = await operation();
      return {
        success: true,
        data: result,
        attempts
      };
    } catch (error) {
      lastError = error as Error;
      
      // If this is the last attempt, don't delay
      if (i === maxRetries) {
        break;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(baseDelay * Math.pow(backoffFactor, i), maxDelay);
      
      console.warn(`Attempt ${i + 1} failed, retrying in ${delay}ms...`, error);
      
      // Wait before retrying
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  return {
    success: false,
    error: lastError || new Error('Unknown error'),
    attempts
  };
}

export function showConnectionError(attempts: number) {
  const message = `Unable to connect to the server after ${attempts} attempts. Please check your internet connection and try again. Our technical team has been notified of this issue.`;
  
  // You can customize this to use a toast notification library instead
  alert(message);
  
  // Log for monitoring
  console.error('Connection failed after retries:', {
    attempts,
    timestamp: new Date().toISOString(),
    userAgent: navigator.userAgent,
    online: navigator.onLine
  });
} 
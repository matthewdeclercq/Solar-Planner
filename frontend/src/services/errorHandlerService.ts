/**
 * Error handler service
 * Centralized error handling and error boundary pattern for Alpine.js
 */

import Alpine from 'alpinejs';
import { logger } from './loggerService';

export interface ErrorContext {
  component?: string;
  action?: string;
  additionalInfo?: Record<string, unknown>;
}

export class AppError extends Error {
  constructor(
    message: string,
    public readonly context?: ErrorContext,
    public readonly originalError?: Error | unknown
  ) {
    super(message);
    this.name = 'AppError';
    // Maintains proper stack trace for where error was thrown
    if ((Error as any).captureStackTrace) {
      (Error as any).captureStackTrace(this, AppError);
    }
  }
}

/**
 * Handle errors with context and user-friendly messages
 */
export function handleError(
  error: Error | unknown,
  context?: ErrorContext,
  showToUser = true
): void {
  // Log the error
  const errorMessage = error instanceof Error ? error.message : String(error);
  logger.error(
    `Error in ${context?.component || 'unknown component'}: ${errorMessage}`,
    error instanceof Error ? error : new Error(String(error)),
    context
  );

  // Show error to user via UI store if requested
  if (showToUser) {
    try {
      const uiStore = Alpine.store('ui') as { setError?: (error: string) => void };
      if (uiStore?.setError) {
        const userMessage = getUserFriendlyMessage(error);
        uiStore.setError(userMessage);
      }
    } catch (storeError) {
      // If store is not available, log but don't throw
      logger.error('Failed to set error in store', storeError);
    }
  }
}

/**
 * Get user-friendly error message
 */
function getUserFriendlyMessage(error: Error | unknown): string {
  if (error instanceof AppError && error.message) {
    return error.message;
  }

  if (error instanceof Error) {
    // Network errors
    if (error.message.includes('fetch') || error.message.includes('network')) {
      return 'Network error. Please check your connection and try again.';
    }

    // Authentication errors
    if (error.message.includes('auth') || error.message.includes('401')) {
      return 'Authentication failed. Please login again.';
    }

    // API errors
    if (error.message.includes('status')) {
      return 'Server error. Please try again later.';
    }

    // Return the error message if it's user-friendly
    if (error.message.length < 100) {
      return error.message;
    }
  }

  // Default message
  return 'An unexpected error occurred. Please try again.';
}

/**
 * Wrap async functions with error handling
 */
export function withErrorHandling<T extends unknown[]>(
  fn: (...args: T) => Promise<void>,
  context?: ErrorContext
): (...args: T) => Promise<void> {
  return async (...args: T) => {
    try {
      await fn(...args);
    } catch (error) {
      handleError(error, context);
    }
  };
}

/**
 * Create an error boundary for Alpine.js components
 * This can be used to wrap component methods that might throw errors
 */
export function createErrorBoundary(componentName: string) {
  return {
    /**
     * Wrap a method with error handling
     */
    wrap<T extends unknown[]>(
      method: (...args: T) => void | Promise<void>,
      actionName?: string
    ): (...args: T) => void | Promise<void> {
      return async (...args: T) => {
        try {
          return await method(...args);
        } catch (error) {
          handleError(error, {
            component: componentName,
            action: actionName || method.name,
          });
        }
      };
    },
  };
}

/**
 * Handle unhandled promise rejections
 */
export function handleUnhandledRejection(event: PromiseRejectionEvent): void {
  event.preventDefault();
  handleError(
    event.reason,
    {
      component: 'global',
      action: 'unhandledRejection',
    },
    false // Don't show unhandled rejections to users by default
  );
}

/**
 * Handle uncaught errors
 */
export function handleUncaughtError(event: ErrorEvent): void {
  event.preventDefault();
  handleError(
    event.error || event.message,
    {
      component: 'global',
      action: 'uncaughtError',
    },
    false // Don't show uncaught errors to users by default (they're usually dev errors)
  );
}

import { EventListenerManager } from '../index';

/**
 * Error handler function type
 */
export type ErrorHandler = (error: Error, event: Event) => void | Promise<void>;

/**
 * Error boundary options
 */
export interface ErrorBoundaryOptions {
    /** Custom error handler */
    onError?: ErrorHandler;
    /** Whether to prevent error propagation */
    preventPropagation?: boolean;
    /** Whether to retry failed handlers */
    retry?: boolean;
    /** Maximum retry attempts */
    maxRetries?: number;
}

/**
 * Extends EventListenerManager with error boundary support
 */
export function withErrorBoundary(manager: EventListenerManager) {
    return {
        ...manager,
        addProtectedListener(
            element: Element,
            event: string,
            listener: (event: Event) => void | Promise<void>,
            options: ErrorBoundaryOptions = {}
        ): void {
            const {
                onError = console.error,
                preventPropagation = true,
                retry = false,
                maxRetries = 3
            } = options;

            const protectedListener = async (event: Event) => {
                let attempts = 0;
                
                const executeWithRetry = async (): Promise<void> => {
                    try {
                        await Promise.resolve(listener(event));
                    } catch (error) {
                        attempts++;
                        
                        if (error instanceof Error) {
                            await Promise.resolve(onError(error, event));
                            
                            if (preventPropagation) {
                                event.stopPropagation();
                                event.preventDefault();
                            }
                            
                            if (retry && attempts < maxRetries) {
                                console.warn(`Retrying event handler (attempt ${attempts + 1}/${maxRetries})`);
                                await executeWithRetry();
                            }
                        }
                    }
                };

                await executeWithRetry();
            };

            manager.addListener(element, event, protectedListener);
        }
    };
}

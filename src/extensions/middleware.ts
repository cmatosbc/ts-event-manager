import { EventListenerManager } from '../index';

/**
 * Middleware function type for event processing
 */
export type EventMiddleware = (
    event: Event,
    next: () => Promise<void>
) => Promise<void>;

/**
 * Configuration for middleware
 */
export interface MiddlewareOptions {
    /** Whether to run middleware in parallel */
    parallel?: boolean;
    /** Whether to continue on middleware error */
    continueOnError?: boolean;
}

/**
 * Extends EventListenerManager with middleware support
 */
export function withMiddleware(manager: EventListenerManager) {
    const middlewares: EventMiddleware[] = [];
    
    const executeMiddlewareChain = async (event: Event, middlewareList: EventMiddleware[]): Promise<void> => {
        const execute = async (index: number): Promise<void> => {
            if (index >= middlewareList.length) return;
            
            await middlewareList[index](event, () => execute(index + 1));
        };
        
        await execute(0);
    };

    return {
        ...manager,
        use(middleware: EventMiddleware) {
            middlewares.push(middleware);
            return this;
        },

        addListenerWithMiddleware(
            element: Element,
            event: string,
            listener: (event: Event) => void | Promise<void>,
            options: MiddlewareOptions = {}
        ): void {
            const wrappedListener = async (event: Event) => {
                try {
                    if (options.parallel) {
                        // Run middlewares in parallel
                        await Promise.all(
                            middlewares.map(middleware => 
                                middleware(event, async () => {})
                                    .catch(err => {
                                        if (!options.continueOnError) throw err;
                                        console.error('Middleware error:', err);
                                    })
                            )
                        );
                    } else {
                        // Run middlewares in sequence
                        await executeMiddlewareChain(event, middlewares);
                    }
                    
                    await Promise.resolve(listener(event));
                } catch (error) {
                    console.error('Event handler error:', error);
                    if (!options.continueOnError) throw error;
                }
            };

            manager.addListener(element, event, wrappedListener);
        }
    };
}

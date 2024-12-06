import { EventListenerManager } from '../index';

/**
 * Options for debounced or throttled event listeners
 */
export interface TimingOptions {
    /** Delay in milliseconds */
    delay: number;
    /** Whether to use throttling instead of debouncing */
    isThrottle?: boolean;
    /** Whether to trigger on the leading edge */
    leading?: boolean;
    /** Whether to trigger on the trailing edge (debounce only) */
    trailing?: boolean;
}

/**
 * Creates a debounced or throttled version of a function
 */
function createTimedFunction<T extends (...args: any[]) => any>(
    func: T,
    options: TimingOptions
): T {
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let lastRun = 0;

    return function (this: any, ...args: Parameters<T>) {
        const context = this;

        if (options.isThrottle) {
            const now = Date.now();
            if (now - lastRun >= options.delay) {
                func.apply(context, args);
                lastRun = now;
            }
        } else {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            if (options.leading && !timeoutId) {
                func.apply(context, args);
            }

            timeoutId = setTimeout(() => {
                if (options.trailing !== false) {
                    func.apply(context, args);
                }
                timeoutId = undefined;
            }, options.delay);
        }
    } as T;
}

/**
 * Extends EventListenerManager with timing functionality
 */
export function withTiming(manager: EventListenerManager) {
    return {
        ...manager,
        addTimedListener(
            element: Element,
            event: string,
            listener: (event: Event) => void,
            options: TimingOptions,
            condition?: () => boolean
        ): void {
            const timedListener = createTimedFunction(listener, options);
            manager.addListener(element, event, timedListener, condition);
        }
    };
}

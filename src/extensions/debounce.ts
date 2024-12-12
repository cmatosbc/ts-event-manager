/**
 * Options for debounced event listeners
 */
export interface DebounceOptions {
    /** Delay in milliseconds before the event handler is called */
    delay: number;
    /** If true, calls handler on leading edge instead of trailing */
    leading?: boolean;
    /** Maximum time to wait before forcing an update */
    maxWait?: number;
}

type EventHandler = (event: Event) => void;

/**
 * Creates a debounced version of an event listener
 * @param listener - The original event listener
 * @param options - Debounce configuration options
 * @returns A debounced version of the listener
 */
export function createDebouncedListener(
    listener: EventListenerOrEventListenerObject,
    options: DebounceOptions
): EventHandler {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let maxWaitTimeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastCallTime: number | null = null;
    let lastInvokeTime: number = Date.now();

    const { delay, leading = false, maxWait } = options;

    const invokeFunction = (thisArg: any, event: Event) => {
        lastInvokeTime = Date.now();
        if (typeof listener === 'function') {
            listener.call(thisArg, event);
        } else if (typeof listener.handleEvent === 'function') {
            listener.handleEvent.call(listener, event);
        }
    };

    const clearTimeouts = () => {
        if (timeoutId !== null) {
            clearTimeout(timeoutId);
            timeoutId = null;
        }
        if (maxWaitTimeoutId !== null) {
            clearTimeout(maxWaitTimeoutId);
            maxWaitTimeoutId = null;
        }
    };

    const debouncedListener = function(this: any, event: Event) {
        const time = Date.now();
        const isFirstCall = lastCallTime === null;
        lastCallTime = time;

        if (isFirstCall && leading) {
            invokeFunction(this, event);
            return;
        }

        clearTimeouts();

        // Set up the main debounce timeout
        timeoutId = setTimeout(() => {
            invokeFunction(this, event);
            lastCallTime = null;
            clearTimeouts();
        }, delay);

        // Handle maxWait if specified
        if (maxWait !== undefined && !maxWaitTimeoutId) {
            const timeSinceLastInvoke = time - lastInvokeTime;
            const remainingMaxWait = Math.max(0, maxWait - timeSinceLastInvoke);

            if (remainingMaxWait === 0) {
                // maxWait has elapsed, invoke immediately
                clearTimeouts();
                invokeFunction(this, event);
                lastCallTime = null;
            } else {
                // Set maxWait timeout
                maxWaitTimeoutId = setTimeout(() => {
                    clearTimeouts();
                    invokeFunction(this, event);
                    lastCallTime = null;
                }, remainingMaxWait);
            }
        }
    };

    return debouncedListener;
}

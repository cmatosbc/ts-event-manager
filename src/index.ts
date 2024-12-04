/**
 * Information about an event listener
 */
export interface EventListenerInfo {
    /** The DOM element the listener is attached to */
    element: Element;
    /** The event type (e.g., 'click', 'scroll') */
    event: string;
    /** The event listener function or object */
    listener: EventListenerOrEventListenerObject;
    /** Optional condition that must be true for the listener to be active */
    condition?: () => boolean;
    /** Chain position (undefined if not part of a chain) */
    chainPosition?: number;
    /** Chain ID for grouped handlers */
    chainId?: string;
    /** Whether this is a chained event handler */
    isChainedHandler?: boolean;
}

/**
 * Result from a chained event handler
 */
export interface ChainedEventResult<T = any> {
    /** The modified data to pass to the next handler */
    data: T;
    /** Whether to continue the chain (true) or stop (false) */
    continue: boolean;
}

/**
 * A handler function in an event chain
 */
export type ChainedEventHandler<T = any> = (
    event: Event,
    data?: T
) => ChainedEventResult<T> | Promise<ChainedEventResult<T>>;

/**
 * Manages DOM event listeners with intersection observer support and automatic cleanup
 */
export class EventListenerManager {
    private listenerMap: WeakMap<Element, EventListenerInfo[]>;
    private readonly observer: IntersectionObserver;
    private readonly mutationObserver: MutationObserver;
    private chainedHandlers: Map<string, ChainedEventHandler[]>;

    /**
     * Creates a new EventListenerManager instance
     * @param intersectionOptions - Optional configuration for the IntersectionObserver
     */
    constructor(intersectionOptions?: IntersectionObserverInit) {
        this.listenerMap = new WeakMap<Element, EventListenerInfo[]>();
        this.chainedHandlers = new Map<string, ChainedEventHandler[]>();
        
        this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
            root: null,
            rootMargin: '0px',
            threshold: [0, 0.1],
            ...intersectionOptions
        });

        this.mutationObserver = new MutationObserver(mutations => {
            mutations.forEach(mutation => {
                mutation.removedNodes.forEach(node => {
                    if (node instanceof Element) {
                        const listeners = this.listenerMap.get(node);
                        if (listeners) {
                            listeners.forEach(info => {
                                this.removeListener(info.element, info.event, info.listener);
                            });
                        }
                    }
                });
            });
        });
        this.mutationObserver.observe(document.body, { childList: true, subtree: true });

        if (typeof window !== 'undefined') {
            window.addEventListener('unload', this.handleUnload.bind(this));
        }
    }

    /**
     * Adds an event listener with optional condition
     * @param element - The DOM element to attach the listener to
     * @param event - The event type (e.g., 'click', 'scroll')
     * @param listener - The event listener function or object
     * @param condition - Optional condition that must be true for the listener to be active
     */
    public addListener(
        element: Element,
        event: string,
        listener: EventListenerOrEventListenerObject,
        condition?: () => boolean
    ): void {
        type ProxyHandler<T> = {
            apply(target: T, thisArg: any, argumentsList: [Event]): any;
        };

        const proxyHandler: ProxyHandler<typeof listener> = {
            apply: (target, thisArg, [event]) => {
                try {
                    if (!condition || condition()) {
                        return typeof target === 'function'
                            ? target.call(thisArg, event)
                            : (target as EventListenerObject).handleEvent.call(thisArg, event);
                    }
                } catch (error) {
                    console.error(`Error in event listener for ${event.type}:`, error);
                }
            }
        };

        const proxyListener = new Proxy(listener, proxyHandler);

        const listeners = this.listenerMap.get(element) || [];
        listeners.push({ element, event, listener: proxyListener, condition });
        this.listenerMap.set(element, listeners);
        
        // Immediately attach the listener if there's no condition or condition is true
        if (!condition || condition()) {
            element.addEventListener(event, proxyListener);
            element.setAttribute('data-listener-attached', 'true');
        }
        
        this.observer.observe(element);
    }

    /**
     * Removes an event listener
     * @param element - The DOM element to remove the listener from
     * @param event - The event type
     * @param listener - The event listener to remove
     */
    private removeListener(
        element: Element,
        event: string,
        listener: EventListenerOrEventListenerObject
    ): void {
        element.removeEventListener(event, listener);
        this.observer.unobserve(element);
        const listeners = this.listenerMap.get(element) || [];
        const updatedListeners = listeners.filter(info => info.listener !== listener);
        if (updatedListeners.length > 0) {
            this.listenerMap.set(element, updatedListeners);
        } else {
            this.listenerMap.delete(element);
        }
    }

    private handleIntersect(entries: IntersectionObserverEntry[]): void {
        entries.forEach(entry => {
            const { target, isIntersecting } = entry;
            const listeners = this.listenerMap.get(target);

            if (listeners) {
                listeners.forEach(listenerInfo => {
                    const shouldAttach = isIntersecting && (!listenerInfo.condition || listenerInfo.condition());
                    const isAttached = target.hasAttribute('data-listener-attached');

                    if (shouldAttach && !isAttached) {
                        target.addEventListener(listenerInfo.event, listenerInfo.listener);
                        target.setAttribute('data-listener-attached', 'true');
                    } else if (!shouldAttach && isAttached) {
                        target.removeEventListener(listenerInfo.event, listenerInfo.listener);
                        target.removeAttribute('data-listener-attached');
                    }
                });
            }
        });
    }

    private handleUnload(): void {
        const elements = new Set<Element>();
        
        // Use document.querySelectorAll since WeakMap doesn't support iteration
        document.querySelectorAll('*').forEach((element: Element) => {
            const listeners = this.listenerMap.get(element);
            if (listeners && document.contains(element)) {
                elements.add(element);
            }
        });
        
        // Clean up listeners and observers
        elements.forEach((element: Element) => {
            const listeners = this.listenerMap.get(element);
            if (listeners) {
                listeners.forEach(listenerInfo => {
                    try {
                        element.removeEventListener(listenerInfo.event, listenerInfo.listener);
                        element.removeAttribute('data-listener-attached');
                    } catch (e) {
                        // Ignore errors during cleanup
                    }
                });
                try {
                    this.observer.unobserve(element);
                } catch (e) {
                    // Ignore errors during cleanup
                }
                this.listenerMap.delete(element);
            }
        });
        
        // Clean up observers
        this.observer.disconnect();
        this.mutationObserver.disconnect();
    }

    /**
     * Cleans up all event listeners and observers
     */
    public cleanUp(): void {
        // Disconnect observers first
        this.observer.disconnect();
        this.mutationObserver.disconnect();

        // Clean up all listeners
        document.querySelectorAll('[data-listener-attached]').forEach(element => {
            const listeners = this.listenerMap.get(element);
            if (listeners) {
                listeners.forEach(listenerInfo => {
                    element.removeEventListener(listenerInfo.event, listenerInfo.listener);
                    element.removeAttribute('data-listener-attached');
                });
            }
        });
        
        // Clear the map
        this.listenerMap = new WeakMap<Element, EventListenerInfo[]>();
    }

    /**
     * Creates a new event chain
     * @param chainId - Unique identifier for the chain
     * @param element - The DOM element to attach the chain to
     * @param event - The event type that triggers the chain
     * @param handlers - Array of handler functions to execute in sequence
     */
    public createEventChain<T = any>(
        chainId: string,
        element: Element,
        event: string,
        handlers: ChainedEventHandler<T>[]
    ): void {
        if (this.chainedHandlers.has(chainId)) {
            throw new Error(`Chain with ID ${chainId} already exists`);
        }

        this.chainedHandlers.set(chainId, handlers);

        // Create a proxy handler that will execute the chain
        const chainExecutor = async (event: Event) => {
            let currentData: any = undefined;
            const chain = this.chainedHandlers.get(chainId) || [];

            for (const handler of chain) {
                try {
                    const result = await handler(event, currentData);
                    if (!result.continue) {
                        break;
                    }
                    currentData = result.data;
                } catch (error) {
                    console.error(`Error in chain ${chainId}:`, error);
                    break;
                }
            }
        };

        // Add the chain executor as a listener
        this.addListener(element, event, chainExecutor);

        // Store chain information for each handler
        handlers.forEach((handler, index) => {
            const listenerInfo: EventListenerInfo = {
                element,
                event,
                listener: handler as EventListenerOrEventListenerObject,
                chainId,
                chainPosition: index,
                isChainedHandler: true
            };

            const listeners = this.listenerMap.get(element) || [];
            listeners.push(listenerInfo);
            this.listenerMap.set(element, listeners);
        });
    }

    /**
     * Removes an event chain
     * @param chainId - The ID of the chain to remove
     */
    public removeEventChain(chainId: string): void {
        if (!this.chainedHandlers.has(chainId)) {
            return;
        }

        // Find all elements with handlers from this chain
        document.querySelectorAll('*').forEach((element: Element) => {
            const listeners = this.listenerMap.get(element);
            if (listeners) {
                const chainListeners = listeners.filter(info => info.chainId === chainId);
                chainListeners.forEach(info => {
                    this.removeListener(info.element, info.event, info.listener);
                });
            }
        });

        this.chainedHandlers.delete(chainId);
    }

    /**
     * Adds or updates a handler in an existing chain
     * @param chainId - The ID of the chain
     * @param handler - The new handler to add
     * @param position - Optional position in the chain (appends to end if not specified)
     */
    public addToChain<T = any>(
        chainId: string,
        handler: ChainedEventHandler<T>,
        position?: number
    ): void {
        const handlers = this.chainedHandlers.get(chainId);
        if (!handlers) {
            throw new Error(`Chain with ID ${chainId} does not exist`);
        }

        if (position !== undefined) {
            handlers.splice(position, 0, handler);
        } else {
            handlers.push(handler);
        }

        this.chainedHandlers.set(chainId, handlers);
    }
}

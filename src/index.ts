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
}

/**
 * Manages DOM event listeners with intersection observer support and automatic cleanup
 */
export class EventListenerManager {
    private listenerMap: WeakMap<Element, EventListenerInfo[]>;
    private readonly observer: IntersectionObserver;
    private readonly mutationObserver: MutationObserver;

    /**
     * Creates a new EventListenerManager instance
     * @param intersectionOptions - Optional configuration for the IntersectionObserver
     */
    constructor(intersectionOptions?: IntersectionObserverInit) {
        this.listenerMap = new WeakMap<Element, EventListenerInfo[]>();
        
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
}

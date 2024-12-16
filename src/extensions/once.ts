/**
 * Wraps an event listener to ensure it only fires once
 * @param listener The original event listener
 * @returns A wrapped listener that will only fire once
 */
export function once(listener: EventListenerOrEventListenerObject): EventListenerOrEventListenerObject {
    let fired = false;
    
    if (typeof listener === 'function') {
        return function wrappedFunction(this: any, event: Event) {
            if (fired) return;
            fired = true;
            return listener.call(this, event);
        };
    } else {
        return {
            handleEvent(event: Event) {
                if (fired) return;
                fired = true;
                return listener.handleEvent(event);
            }
        };
    }
}

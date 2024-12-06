import { EventListenerManager } from '../index';

/**
 * Options for delegated event listeners
 */
export interface DelegationOptions {
    /** CSS selector to match target elements */
    selector: string;
    /** Whether to stop event propagation after handling */
    stopPropagation?: boolean;
    /** Whether to prevent the default event behavior */
    preventDefault?: boolean;
}

/**
 * Extends EventListenerManager with delegation functionality
 */
export function withDelegation(manager: EventListenerManager) {
    return {
        ...manager,
        addDelegatedListener(
            parentElement: Element,
            event: string,
            options: DelegationOptions,
            listener: (event: Event, delegateTarget: Element) => void,
            condition?: () => boolean
        ): void {
            const delegatedHandler = (event: Event) => {
                const target = event.target as Element;
                const delegateTarget = target.closest(options.selector);

                if (!delegateTarget || !parentElement.contains(delegateTarget)) {
                    return;
                }

                if (options.preventDefault) {
                    event.preventDefault();
                }

                if (options.stopPropagation) {
                    event.stopPropagation();
                }

                listener(event, delegateTarget);
            };

            manager.addListener(parentElement, event, delegatedHandler, condition);
        }
    };
}

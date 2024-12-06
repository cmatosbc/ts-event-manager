import { EventListenerManager } from '../index';

/**
 * Queue options for event handling
 */
export interface QueueOptions {
    /** Maximum queue size */
    maxSize?: number;
    /** Processing batch size */
    batchSize?: number;
    /** Delay between processing batches (ms) */
    batchDelay?: number;
    /** Strategy for when queue is full */
    overflowStrategy?: 'drop-oldest' | 'drop-newest' | 'error';
}

interface QueuedEvent {
    event: Event;
    timestamp: number;
}

/**
 * Extends EventListenerManager with event queuing support
 */
export function withEventQueue(manager: EventListenerManager) {
    const queues = new Map<string, QueuedEvent[]>();
    const processing = new Set<string>();

    const processQueue = async (
        queueId: string,
        listener: (event: Event) => void | Promise<void>,
        options: QueueOptions
    ) => {
        if (processing.has(queueId)) return;
        
        processing.add(queueId);
        const queue = queues.get(queueId) || [];
        
        while (queue.length > 0) {
            const batch = queue.splice(0, options.batchSize || 1);
            
            await Promise.all(
                batch.map(async ({ event }) => {
                    try {
                        await Promise.resolve(listener(event));
                    } catch (error) {
                        console.error('Error processing queued event:', error);
                    }
                })
            );
            
            if (options.batchDelay && queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, options.batchDelay));
            }
        }
        
        processing.delete(queueId);
    };

    return {
        ...manager,
        addQueuedListener(
            element: Element,
            event: string,
            listener: (event: Event) => void | Promise<void>,
            options: QueueOptions = {}
        ): void {
            const queueId = `${element.id || Math.random()}-${event}`;
            const {
                maxSize = 1000,
                overflowStrategy = 'drop-oldest'
            } = options;

            const queuedListener = (event: Event) => {
                const queue = queues.get(queueId) || [];
                const queuedEvent = { event, timestamp: Date.now() };

                if (queue.length >= maxSize) {
                    switch (overflowStrategy) {
                        case 'drop-oldest':
                            queue.shift();
                            queue.push(queuedEvent);
                            break;
                        case 'drop-newest':
                            console.warn('Queue full, dropping new event');
                            break;
                        case 'error':
                            throw new Error('Event queue overflow');
                        default:
                            queue.shift();
                            queue.push(queuedEvent);
                    }
                } else {
                    queue.push(queuedEvent);
                }

                queues.set(queueId, queue);
                processQueue(queueId, listener, options);
            };

            manager.addListener(element, event, queuedListener);
        }
    };
}

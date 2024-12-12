import { createDebouncedListener } from '../debounce';

describe('Debounce Extension', () => {
    beforeEach(() => {
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    test('debounces function calls', () => {
        const mockFn = jest.fn();
        const debouncedFn = createDebouncedListener(mockFn, { delay: 100 });
        const mockEvent = new Event('click');

        // Call multiple times
        debouncedFn(mockEvent);
        debouncedFn(mockEvent);
        debouncedFn(mockEvent);

        // Verify no immediate calls
        expect(mockFn).not.toHaveBeenCalled();

        // Fast forward time
        jest.advanceTimersByTime(150);

        // Verify single call
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith(mockEvent);
    });

    test('handles leading edge option', () => {
        const mockFn = jest.fn();
        const debouncedFn = createDebouncedListener(mockFn, { 
            delay: 100,
            leading: true 
        });
        const mockEvent = new Event('click');

        // First call should execute immediately
        debouncedFn(mockEvent);
        expect(mockFn).toHaveBeenCalledTimes(1);
        expect(mockFn).toHaveBeenCalledWith(mockEvent);

        // Subsequent calls within delay should be debounced
        debouncedFn(mockEvent);
        debouncedFn(mockEvent);
        expect(mockFn).toHaveBeenCalledTimes(1);

        // After delay, should execute once more
        jest.advanceTimersByTime(150);
        expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('respects maxWait option', () => {
        const mockFn = jest.fn();
        const debouncedFn = createDebouncedListener(mockFn, { 
            delay: 200,
            maxWait: 150 
        });
        const mockEvent = new Event('click');

        // Initial call starts the timers
        debouncedFn(mockEvent);
        expect(mockFn).not.toHaveBeenCalled();

        // Call again before maxWait
        jest.advanceTimersByTime(100);
        debouncedFn(mockEvent);
        expect(mockFn).not.toHaveBeenCalled();

        // maxWait should trigger
        jest.advanceTimersByTime(50);
        expect(mockFn).toHaveBeenCalledTimes(1);

        // New calls should start a new cycle
        debouncedFn(mockEvent);
        jest.advanceTimersByTime(200);
        expect(mockFn).toHaveBeenCalledTimes(2);
    });

    test('handles event listener objects', () => {
        const mockListenerObj = {
            handleEvent: jest.fn()
        };
        const debouncedFn = createDebouncedListener(mockListenerObj, { delay: 100 });
        const mockEvent = new Event('click');

        // Call multiple times
        debouncedFn(mockEvent);
        debouncedFn(mockEvent);

        // Verify no immediate calls
        expect(mockListenerObj.handleEvent).not.toHaveBeenCalled();

        // Fast forward time
        jest.advanceTimersByTime(150);

        // Verify single call
        expect(mockListenerObj.handleEvent).toHaveBeenCalledTimes(1);
        expect(mockListenerObj.handleEvent).toHaveBeenCalledWith(mockEvent);
    });

    test('properly cleans up timeouts', () => {
        const mockFn = jest.fn();
        const debouncedFn = createDebouncedListener(mockFn, { delay: 100 });
        const mockEvent = new Event('click');

        // Start a debounce cycle
        debouncedFn(mockEvent);
        expect(mockFn).not.toHaveBeenCalled();

        // Call again before timeout
        jest.advanceTimersByTime(50);
        debouncedFn(mockEvent);
        expect(mockFn).not.toHaveBeenCalled();

        // Wait for timeout
        jest.advanceTimersByTime(100);
        expect(mockFn).toHaveBeenCalledTimes(1);

        // Ensure no more calls occur
        jest.advanceTimersByTime(1000);
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    test('maintains correct this context', () => {
        const context = { value: 42 };
        const mockFn = jest.fn(function(this: typeof context, event: Event) {
            expect(this).toBe(context);
        });
        
        const debouncedFn = createDebouncedListener(mockFn, { delay: 100 });
        const mockEvent = new Event('click');

        // Call with specific context
        debouncedFn.bind(context)(mockEvent);
        jest.advanceTimersByTime(150);

        expect(mockFn).toHaveBeenCalledTimes(1);
    });
});

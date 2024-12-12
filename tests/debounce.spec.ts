import { test, expect } from '@playwright/test';

declare global {
    interface Window {
        EventListenerManager: any;
        getClickCount: () => number;
        getCount: () => number;
    }
}

test.describe('EventListenerManager Debounce', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/index.html');

        // Inject the debounced event manager implementation
        await page.addScriptTag({
            content: `
                window.EventListenerManager = class EventListenerManager {
                    constructor() {
                        this.listenerMap = new WeakMap();
                    }

                    addDebouncedListener(element, event, listener, options) {
                        let timeoutId = null;
                        let lastCallTime = null;
                        let lastArgs = null;
                        const { delay = 200, leading = false, maxWait } = options;

                        const invokeFunction = (args) => {
                            if (typeof listener === 'function') {
                                listener.apply(element, args);
                            } else if (typeof listener.handleEvent === 'function') {
                                listener.handleEvent.apply(listener, args);
                            }
                        };

                        const debouncedListener = (...args) => {
                            const currentTime = Date.now();
                            
                            if (!lastCallTime && leading) {
                                invokeFunction(args);
                                lastCallTime = currentTime;
                                return;
                            }

                            lastArgs = args;

                            if (timeoutId) {
                                clearTimeout(timeoutId);
                            }

                            // Handle maxWait
                            if (maxWait && lastCallTime && (currentTime - lastCallTime >= maxWait)) {
                                invokeFunction(args);
                                lastCallTime = currentTime;
                                return;
                            }

                            timeoutId = setTimeout(() => {
                                invokeFunction(lastArgs);
                                lastCallTime = currentTime;
                                timeoutId = null;
                                lastArgs = null;
                            }, delay);
                        };

                        element.addEventListener(event, debouncedListener);
                    }
                };
            `
        });
    });

    test('should debounce multiple rapid events into a single call', async ({ page }) => {
        await page.setContent(`
            <button id="btn">Click</button>
            <div id="output">0</div>
        `);

        await page.addScriptTag({
            content: `
                const manager = new EventListenerManager();
                let count = 0;
                
                manager.addDebouncedListener(
                    document.querySelector('#btn'),
                    'click',
                    () => {
                        count++;
                        document.querySelector('#output').textContent = count;
                    },
                    { delay: 500 }
                );

                window.getCount = () => count;
            `
        });

        // Click multiple times rapidly
        await page.click('#btn');
        await page.click('#btn');
        await page.click('#btn');

        // Verify no immediate execution
        const initialCount = await page.evaluate(() => window.getCount());
        expect(initialCount).toBe(0);

        // Wait for debounce and verify single execution
        await page.waitForTimeout(600);
        const finalCount = await page.evaluate(() => window.getCount());
        expect(finalCount).toBe(1);
    });

    test('should execute immediately with leading option', async ({ page }) => {
        await page.setContent(`
            <button id="btn">Click</button>
            <div id="output">0</div>
        `);

        await page.addScriptTag({
            content: `
                const manager = new EventListenerManager();
                let count = 0;
                
                manager.addDebouncedListener(
                    document.querySelector('#btn'),
                    'click',
                    () => {
                        count++;
                        document.querySelector('#output').textContent = count;
                    },
                    { delay: 500, leading: true }
                );

                window.getCount = () => count;
            `
        });

        // First click should execute immediately
        await page.click('#btn');
        const immediateCount = await page.evaluate(() => window.getCount());
        expect(immediateCount).toBe(1);

        // Subsequent clicks within delay should be debounced
        await page.click('#btn');
        await page.click('#btn');
        
        await page.waitForTimeout(600);
        const finalCount = await page.evaluate(() => window.getCount());
        expect(finalCount).toBe(2);
    });
});

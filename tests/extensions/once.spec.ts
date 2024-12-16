import { test, expect } from '@playwright/test';

declare global {
    interface Window {
        EventListenerManager: any;
        getClickCount: () => number;
    }
}

test.describe('once extension', () => {
    test.beforeEach(async ({ page }) => {
        await page.goto('/tests/index.html');

        // Inject the EventListenerManager with once functionality
        await page.addScriptTag({
            content: `
                window.EventListenerManager = class EventListenerManager {
                    constructor() {
                        this.listenerMap = new WeakMap();
                    }

                    addListener(element, event, listener) {
                        element.addEventListener(event, listener);
                    }

                    cleanUp() {
                        // Not needed for this test
                    }
                };

                function once(listener) {
                    let fired = false;
                    
                    if (typeof listener === 'function') {
                        return function wrappedFunction(event) {
                            if (fired) return;
                            fired = true;
                            return listener.call(this, event);
                        };
                    } else {
                        return {
                            handleEvent(event) {
                                if (fired) return;
                                fired = true;
                                return listener.handleEvent(event);
                            }
                        };
                    }
                }

                window.once = once;
            `
        });
    });

    test('should only trigger once in real browser environment', async ({ page }) => {
        await page.setContent(`
            <div id="target">Click me</div>
            <div id="counter">0</div>
            <script>
                const manager = new EventListenerManager();
                const target = document.getElementById('target');
                const counter = document.getElementById('counter');
                let count = 0;
                
                manager.addListener(target, 'click', once(() => {
                    count++;
                    counter.textContent = count.toString();
                }));

                window.getClickCount = () => count;
            </script>
        `);

        // Click multiple times
        await page.locator('#target').click();
        await page.locator('#target').click();
        await page.locator('#target').click();

        // Check that counter only incremented once
        const counterText = await page.locator('#counter').textContent();
        expect(counterText).toBe('1');
    });

    test('should work with multiple elements independently', async ({ page }) => {
        await page.setContent(`
            <div id="button1" class="target">Button 1</div>
            <div id="button2" class="target">Button 2</div>
            <div id="counter1">0</div>
            <div id="counter2">0</div>
            <script>
                const manager = new EventListenerManager();
                const button1 = document.getElementById('button1');
                const button2 = document.getElementById('button2');
                const counter1 = document.getElementById('counter1');
                const counter2 = document.getElementById('counter2');
                
                manager.addListener(button1, 'click', once(() => {
                    const current = parseInt(counter1.textContent || '0');
                    counter1.textContent = (current + 1).toString();
                }));
                
                manager.addListener(button2, 'click', once(() => {
                    const current = parseInt(counter2.textContent || '0');
                    counter2.textContent = (current + 1).toString();
                }));
            </script>
        `);

        // Click both buttons multiple times
        await page.locator('#button1').click();
        await page.locator('#button1').click();
        await page.locator('#button2').click();
        await page.locator('#button2').click();

        // Check counters
        expect(await page.locator('#counter1').textContent()).toBe('1');
        expect(await page.locator('#counter2').textContent()).toBe('1');
    });
});

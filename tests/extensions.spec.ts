import { test, expect } from '@playwright/test';
import { EventListenerManager } from '../src';
import {
    withMiddleware,
    withErrorBoundary,
    withEventQueue,
    withTiming,
    withDelegation
} from '../src/extensions';

test.describe('Event Manager Extensions', () => {
    test.describe('Middleware Extension', () => {
        test('should execute middleware in correct order', async ({ page }) => {
            await page.setContent(`
                <button id="testButton">Click Me</button>
            `);

            const events: string[] = [];
            
            await page.evaluate(() => {
                const { EventListenerManager } = window.tsEventManager;
                const { withMiddleware } = window.tsEventManager.extensions;
                
                const manager = withMiddleware(new EventListenerManager());
                const button = document.getElementById('testButton');

                manager.use(async (event, next) => {
                    window.testEvents = window.testEvents || [];
                    window.testEvents.push('before1');
                    await next();
                    window.testEvents.push('after1');
                });

                manager.use(async (event, next) => {
                    window.testEvents.push('before2');
                    await next();
                    window.testEvents.push('after2');
                });

                manager.addListenerWithMiddleware(button, 'click', () => {
                    window.testEvents.push('handler');
                });
            });

            await page.click('#testButton');
            const events = await page.evaluate(() => window.testEvents);
            
            expect(events).toEqual([
                'before1',
                'before2',
                'handler',
                'after2',
                'after1'
            ]);
        });
    });

    test.describe('Error Boundary Extension', () => {
        test('should handle errors and retry', async ({ page }) => {
            await page.setContent(`
                <button id="testButton">Click Me</button>
            `);

            await page.evaluate(() => {
                const { EventListenerManager } = window.tsEventManager;
                const { withErrorBoundary } = window.tsEventManager.extensions;
                
                const manager = withErrorBoundary(new EventListenerManager());
                const button = document.getElementById('testButton');

                let attempts = 0;
                window.errorsCaught = 0;

                manager.addProtectedListener(
                    button,
                    'click',
                    () => {
                        attempts++;
                        if (attempts < 3) {
                            throw new Error('Test error');
                        }
                        window.successfulAttempt = attempts;
                    },
                    {
                        onError: () => {
                            window.errorsCaught++;
                        },
                        retry: true,
                        maxRetries: 3
                    }
                );
            });

            await page.click('#testButton');
            
            const errorsCaught = await page.evaluate(() => window.errorsCaught);
            const successfulAttempt = await page.evaluate(() => window.successfulAttempt);
            
            expect(errorsCaught).toBe(2);
            expect(successfulAttempt).toBe(3);
        });
    });

    test.describe('Event Queue Extension', () => {
        test('should process events in batches', async ({ page }) => {
            await page.setContent(`
                <div id="scrollContainer" style="height: 200px; overflow: auto;">
                    <div style="height: 1000px;"></div>
                </div>
            `);

            await page.evaluate(() => {
                const { EventListenerManager } = window.tsEventManager;
                const { withEventQueue } = window.tsEventManager.extensions;
                
                const manager = withEventQueue(new EventListenerManager());
                const container = document.getElementById('scrollContainer');

                window.processedEvents = 0;

                manager.addQueuedListener(
                    container,
                    'scroll',
                    () => {
                        window.processedEvents++;
                    },
                    {
                        maxSize: 100,
                        batchSize: 5,
                        batchDelay: 50
                    }
                );
            });

            // Generate multiple scroll events rapidly
            const container = page.locator('#scrollContainer');
            for (let i = 0; i < 20; i++) {
                await container.evaluate((el, i) => {
                    el.scrollTop = i * 10;
                }, i);
            }

            // Wait for batch processing
            await page.waitForTimeout(200);

            const processedEvents = await page.evaluate(() => window.processedEvents);
            expect(processedEvents).toBeLessThan(20); // Should be batched
            expect(processedEvents).toBeGreaterThan(0);
        });
    });

    test.describe('Timing Extension', () => {
        test('should debounce events', async ({ page }) => {
            await page.setContent(`
                <div id="resizeTarget" style="width: 100px; height: 100px;"></div>
            `);

            await page.evaluate(() => {
                const { EventListenerManager } = window.tsEventManager;
                const { withTiming } = window.tsEventManager.extensions;
                
                const manager = withTiming(new EventListenerManager());
                const target = document.getElementById('resizeTarget');

                window.handlerCalls = 0;

                manager.addTimedListener(
                    target,
                    'resize',
                    () => {
                        window.handlerCalls++;
                    },
                    { delay: 100 }
                );
            });

            // Trigger multiple resize events rapidly
            for (let i = 0; i < 5; i++) {
                await page.evaluate(() => {
                    const event = new Event('resize');
                    document.getElementById('resizeTarget').dispatchEvent(event);
                });
                await page.waitForTimeout(20);
            }

            // Wait for debounce
            await page.waitForTimeout(150);

            const handlerCalls = await page.evaluate(() => window.handlerCalls);
            expect(handlerCalls).toBe(1); // Should be called only once
        });
    });

    test.describe('Delegation Extension', () => {
        test('should handle delegated events', async ({ page }) => {
            await page.setContent(`
                <div id="container">
                    <button class="target">Button 1</button>
                    <button class="target">Button 2</button>
                </div>
            `);

            await page.evaluate(() => {
                const { EventListenerManager } = window.tsEventManager;
                const { withDelegation } = window.tsEventManager.extensions;
                
                const manager = withDelegation(new EventListenerManager());
                const container = document.getElementById('container');

                window.clickedButtons = [];

                manager.addDelegatedListener(
                    container,
                    'click',
                    { selector: '.target' },
                    (event, target) => {
                        window.clickedButtons.push(target.textContent);
                    }
                );
            });

            await page.click('text=Button 1');
            await page.click('text=Button 2');

            const clickedButtons = await page.evaluate(() => window.clickedButtons);
            expect(clickedButtons).toEqual(['Button 1', 'Button 2']);
        });
    });
});

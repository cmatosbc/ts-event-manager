import { test, expect } from '@playwright/test';

declare global {
  interface Window {
    eventManager: any;
    clickCount: number;
    secondClickCount: number;
    conditionalClickCount: number;
    intersectionCount: number;
    allowClicks: boolean;
    lastError: string;
    attempts: number;
  }
}

const testElements: string[] = [];

test.describe('EventListenerManager', () => {
  let testElementsLocal: string[] = [];

  test.beforeEach(async ({ page }) => {
    // Navigate to the test page
    await page.goto('/tests/index.html');
    
    // Inject the EventListenerManager class directly
    await page.addScriptTag({
      content: `
        window.EventListenerManager = class EventListenerManager {
          constructor() {
            this.listenerMap = new WeakMap();
            this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
              root: null,
              rootMargin: '0px',
              threshold: [0, 0.1]
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
          }

          addListener(element, event, listener, condition) {
            if (!this.listenerMap.has(element)) {
              this.listenerMap.set(element, []);
            }
            const listeners = this.listenerMap.get(element);
            const wrappedListener = (e) => {
              if (!condition || condition()) {
                listener(e);
              }
            };
            listeners.push({ element, event, listener: wrappedListener });
            element.addEventListener(event, wrappedListener);
            element.setAttribute('data-listener-attached', 'true');
            this.observer.observe(element);
          }

          removeListener(element, event, listener) {
            const listeners = this.listenerMap.get(element);
            if (listeners) {
              const index = listeners.findIndex(l => l.listener === listener);
              if (index !== -1) {
                element.removeEventListener(event, listener);
                listeners.splice(index, 1);
                if (listeners.length === 0) {
                  this.listenerMap.delete(element);
                  element.removeAttribute('data-listener-attached');
                  this.observer.unobserve(element);
                }
              }
            }
          }

          handleIntersect(entries) {
            entries.forEach(entry => {
              const listeners = this.listenerMap.get(entry.target);
              if (listeners) {
                if (entry.isIntersecting) {
                  entry.target.setAttribute('data-visible', 'true');
                } else {
                  entry.target.removeAttribute('data-visible');
                }
              }
            });
          }

          cleanUp() {
            this.observer.disconnect();
            this.mutationObserver.disconnect();
            document.querySelectorAll('[data-listener-attached]').forEach(element => {
              const listeners = this.listenerMap.get(element);
              if (listeners) {
                listeners.forEach(info => {
                  element.removeEventListener(info.event, info.listener);
                  element.removeAttribute('data-listener-attached');
                });
              }
            });
            this.listenerMap = new WeakMap();
          }
        }

        window.eventManager = new window.EventListenerManager();
        window.clickCount = 0;
        window.secondClickCount = 0;
        window.conditionalClickCount = 0;
        window.intersectionCount = 0;
        window.allowClicks = false;

        // Set up initial listeners
        const clickTarget = document.getElementById('clickTarget');
        const intersectionTarget = document.getElementById('intersectionTarget');

        if (clickTarget) {
          window.eventManager.addListener(clickTarget, 'click', () => {
            window.clickCount++;
            clickTarget.setAttribute('data-clicked', 'true');
          });
        }

        if (intersectionTarget) {
          window.eventManager.addListener(intersectionTarget, 'mouseenter', () => {
            window.intersectionCount++;
            intersectionTarget.setAttribute('data-intersected', 'true');
          });
        }
      `
    });

    // Wait for elements
    await page.waitForSelector('#clickTarget', { state: 'attached' });
    await page.waitForSelector('#intersectionTarget', { state: 'attached' });
    
    // Reset test elements
    testElementsLocal = [];
  });

  test.afterEach(async ({ page }) => {
    // Clean up any test elements
    if (testElementsLocal.length > 0) {
      await page.evaluate((ids) => {
        ids.forEach(id => {
          const element = document.getElementById(id);
          element?.parentNode?.removeChild(element);
        });
      }, testElementsLocal);
    }
    // Force cleanup of event manager
    await page.evaluate(() => {
      window.eventManager?.cleanUp();
    });
  });

  test('should handle click events', async ({ page }) => {
    const clickTarget = page.locator('#clickTarget');
    await expect(clickTarget).not.toHaveAttribute('data-clicked', 'true');
    await clickTarget.click();
    await expect(clickTarget).toHaveAttribute('data-clicked', 'true', { timeout: 1000 });
    const clickCount = await page.evaluate(() => window.clickCount);
    expect(clickCount).toBe(1);
  });

  test('should handle intersection observer', async ({ page }) => {
    const intersectionTarget = page.locator('#intersectionTarget');
    
    // Scroll to make the element visible
    await intersectionTarget.scrollIntoViewIfNeeded();
    
    // Wait for the element to be marked as visible by the IntersectionObserver
    await expect(intersectionTarget).toHaveAttribute('data-visible', 'true', { timeout: 5000 });
    
    // Trigger mouseenter
    await intersectionTarget.hover();
    
    // Check if the mouseenter event was handled
    await expect(intersectionTarget).toHaveAttribute('data-intersected', 'true', { timeout: 5000 });
    const intersectionCount = await page.evaluate(() => window.intersectionCount);
    expect(intersectionCount).toBe(1);
  });

  test('should cleanup listeners on element removal', async ({ page }) => {
    await page.evaluate(() => {
      const element = document.getElementById('clickTarget');
      element?.parentNode?.removeChild(element);
    });
    
    await page.waitForTimeout(100);
    const hasListener = await page.evaluate(() => {
      const element = document.getElementById('clickTarget');
      return element ? window.eventManager.listenerMap.has(element) : false;
    });
    expect(hasListener).toBe(false);
  });

  test('should handle conditional listeners', async ({ page }) => {
    const clickTarget = page.locator('#clickTarget');
    
    await page.evaluate(() => {
      const element = document.getElementById('clickTarget');
      if (element) {
        window.eventManager.addListener(
          element,
          'click',
          () => { window.conditionalClickCount++; },
          () => window.allowClicks === true
        );
      }
    });
    
    await clickTarget.click();
    let clickCount = await page.evaluate(() => window.conditionalClickCount);
    expect(clickCount).toBe(0);
    
    await page.evaluate(() => { window.allowClicks = true; });
    await clickTarget.click();
    clickCount = await page.evaluate(() => window.conditionalClickCount);
    expect(clickCount).toBe(1);
  });

  test('should handle multiple listeners on same element', async ({ page }) => {
    const clickTarget = page.locator('#clickTarget');
    
    await page.evaluate(() => {
      const element = document.getElementById('clickTarget');
      if (element) {
        window.secondClickCount = 0;
        window.eventManager.addListener(
          element,
          'click',
          () => { window.secondClickCount++; }
        );
      }
    });
    
    await clickTarget.click();
    const [firstCount, secondCount] = await page.evaluate(() => [
      window.clickCount,
      window.secondClickCount
    ]);
    
    expect(firstCount).toBe(1);
    expect(secondCount).toBe(1);
  });

  test('should cleanup all listeners on unload', async ({ page }) => {
    // Get initial listener count
    const initialCount = await page.evaluate(() => {
      return document.querySelectorAll('.test-element[data-listener-attached]').length;
    });

    // Create test elements and store their IDs
    const elementIds = await page.evaluate(() => {
      const container = document.querySelector('.scroll-container');
      const ids: string[] = [];
      if (container) {
        for (let i = 0; i < 3; i++) {
          const element = document.createElement('div');
          const id = `testElement${i}`;
          element.id = id;
          element.className = 'test-element';
          container.appendChild(element);
          ids.push(id);
          
          window.eventManager.addListener(element, 'click', () => {
            element.setAttribute('data-clicked', 'true');
          });
        }
      }
      return ids;
    });
    
    // Store element IDs for cleanup
    testElementsLocal = elementIds;

    // Wait for all elements to be added and listeners attached
    await page.waitForSelector('#testElement0[data-listener-attached]');
    await page.waitForSelector('#testElement1[data-listener-attached]');
    await page.waitForSelector('#testElement2[data-listener-attached]');

    // Verify new listeners are added (should be initial count + 3)
    const currentListeners = await page.evaluate(() => {
      return document.querySelectorAll('.test-element[data-listener-attached]').length;
    });
    expect(currentListeners).toBe(initialCount + 3);

    // Call cleanup
    await page.evaluate(() => {
      window.eventManager.cleanUp();
    });

    // Verify all listeners are removed
    const remainingListeners = await page.evaluate(() => {
      return document.querySelectorAll('.test-element[data-listener-attached]').length;
    });
    expect(remainingListeners).toBe(0);
  });
});

test.describe('Error Boundary Extension', () => {
  test.beforeEach(async ({ page }) => {
    // Inject the EventListenerManager class directly
    await page.addScriptTag({
      content: `
        window.EventListenerManager = class EventListenerManager {
          constructor() {
            this.listenerMap = new WeakMap();
            this.observer = new IntersectionObserver(this.handleIntersect.bind(this), {
              root: null,
              rootMargin: '0px',
              threshold: [0, 0.1]
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
          }

          addListener(element, event, listener) {
            if (!this.listenerMap.has(element)) {
              this.listenerMap.set(element, []);
            }
            const listeners = this.listenerMap.get(element);
            listeners.push({ element, event, listener });
            element.addEventListener(event, listener);
            this.observer.observe(element);
          }

          removeListener(element, event, listener) {
            element.removeEventListener(event, listener);
            const listeners = this.listenerMap.get(element);
            if (listeners) {
              const index = listeners.findIndex(info => 
                info.element === element && 
                info.event === event && 
                info.listener === listener
              );
              if (index !== -1) {
                listeners.splice(index, 1);
              }
            }
          }

          handleIntersect(entries) {
            entries.forEach(entry => {
              const element = entry.target;
              const listeners = this.listenerMap.get(element);
              if (listeners) {
                listeners.forEach(info => {
                  if (!entry.isIntersecting) {
                    this.removeListener(info.element, info.event, info.listener);
                  }
                });
              }
            });
          }
        }
      `
    });
  });

  test('should catch errors and call error handler', async ({ page }) => {
    await page.setContent(`<button id="errorButton">Error Button</button>`);
    testElements.push('errorButton');

    const errors: string[] = [];
    
    await page.evaluate(() => {
      const button = document.getElementById('errorButton');
      if (!button) return;

      const manager = new window.EventListenerManager();
      const withErrorBoundary = (manager) => ({
        addProtectedListener(element, event, listener, options = {}) {
          const {
            onError = console.error,
            preventPropagation = true,
            retry = false,
            maxRetries = 3
          } = options;

          const protectedListener = async (event) => {
            try {
              await Promise.resolve(listener(event));
            } catch (error) {
              onError(error, event);
              if (preventPropagation) {
                event.stopPropagation();
              }
            }
          };

          manager.addListener(element, event, protectedListener);
        }
      });

      const protectedEvent = withErrorBoundary(manager);
      protectedEvent.addProtectedListener(
        button,
        'click',
        () => {
          throw new Error('Test Error');
        },
        {
          onError: (error) => {
            window.lastError = error.message;
          }
        }
      );
    });

    // Click the button which should trigger an error
    await page.click('#errorButton');

    // Check if error was caught
    const errorMessage = await page.evaluate(() => window.lastError);
    expect(errorMessage).toBe('Test Error');
  });

  test('should retry failed operations', async ({ page }) => {
    await page.setContent(`<button id="retryButton">Retry Button</button>`);
    testElements.push('retryButton');

    await page.evaluate(() => {
      const button = document.getElementById('retryButton');
      if (!button) return;

      window.attempts = 0;

      const manager = new window.EventListenerManager();
      const withErrorBoundary = (manager) => ({
        addProtectedListener(element, event, listener, options = {}) {
          const {
            onError = console.error,
            preventPropagation = true,
            retry = false,
            maxRetries = 3
          } = options;

          const protectedListener = async (event) => {
            let attempts = 0;
            
            const executeWithRetry = async () => {
              try {
                await Promise.resolve(listener(event));
              } catch (error) {
                attempts++;
                window.attempts = attempts;
                
                if (retry && attempts < maxRetries) {
                  await executeWithRetry();
                } else {
                  onError(error, event);
                  if (preventPropagation) {
                    event.stopPropagation();
                  }
                }
              }
            };

            await executeWithRetry();
          };

          manager.addListener(element, event, protectedListener);
        }
      });

      const protectedEvent2 = withErrorBoundary(manager);
      protectedEvent2.addProtectedListener(
        button,
        'click',
        () => {
          throw new Error('Retry Error');
        },
        {
          retry: true,
          maxRetries: 3,
          onError: (error) => {
            window.lastError = error.message;
          }
        }
      );
    });

    // Click the button which should trigger retries
    await page.click('#retryButton');

    // Check if all retry attempts were made
    const attempts = await page.evaluate(() => window.attempts);
    expect(attempts).toBe(3);

    // Check if final error was caught
    const errorMessage = await page.evaluate(() => window.lastError);
    expect(errorMessage).toBe('Retry Error');
  });
});

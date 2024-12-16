import { once } from '../once';
import { EventListenerManager } from '../../index';

// Mock IntersectionObserver
const mockIntersectionObserver = jest.fn();
mockIntersectionObserver.mockImplementation((callback) => ({
    observe: jest.fn(),
    unobserve: jest.fn(),
    disconnect: jest.fn()
}));
window.IntersectionObserver = mockIntersectionObserver;

// Mock MutationObserver
const mockMutationObserver = jest.fn();
mockMutationObserver.mockImplementation((callback) => ({
    observe: jest.fn(),
    disconnect: jest.fn()
}));
window.MutationObserver = mockMutationObserver;

describe('once extension', () => {
    let manager: EventListenerManager;
    let element: HTMLDivElement;
    let mockEvent: Event;

    beforeEach(() => {
        // Setup DOM
        element = document.createElement('div');
        document.body.appendChild(element);
        // Create mock event
        mockEvent = new Event('click');
        Object.defineProperty(mockEvent, 'currentTarget', {
            value: element,
            writable: true
        });
        // Create new manager instance
        manager = new EventListenerManager();
    });

    afterEach(() => {
        // Cleanup
        document.body.removeChild(element);
        if (manager) {
            manager.cleanUp();
        }
    });

    it('should only call function listener once', () => {
        const mockFn = jest.fn();
        manager.addListener(element, 'click', once(mockFn));
        
        // Simulate multiple clicks using dispatchEvent
        element.dispatchEvent(mockEvent);
        element.dispatchEvent(mockEvent);
        element.dispatchEvent(mockEvent);
        
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should only call EventListenerObject once', () => {
        const mockFn = jest.fn();
        const listenerObj = {
            handleEvent: mockFn
        };
        
        manager.addListener(element, 'click', once(listenerObj));
        
        // Simulate multiple clicks using dispatchEvent
        element.dispatchEvent(mockEvent);
        element.dispatchEvent(mockEvent);
        
        expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should maintain correct this context', () => {
        const context = { value: 'test' };
        let actualThis: any;
        
        const listener = function(this: any, event: Event) {
            actualThis = this;
        };
        
        manager.addListener(element, 'click', once(listener.bind(context)));
        element.dispatchEvent(mockEvent);
        
        expect(actualThis).toBe(context);
    });

    it('should properly remove itself after firing', () => {
        const mockFn = jest.fn();
        manager.addListener(element, 'click', once(mockFn));
        
        // First click
        element.dispatchEvent(mockEvent);
        expect(mockFn).toHaveBeenCalledTimes(1);
        
        // Reset mock
        mockFn.mockReset();
        
        // Additional clicks should not trigger
        element.dispatchEvent(mockEvent);
        element.dispatchEvent(mockEvent);
        
        expect(mockFn).not.toHaveBeenCalled();
    });
});

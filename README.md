# TypeScript Event Manager

[![Node.js CI](https://github.com/cmatosbc/ts-event-manager/actions/workflows/node.js.yml/badge.svg)](https://github.com/cmatosbc/ts-event-manager/actions/workflows/node.js.yml)

A robust TypeScript library for managing DOM event listeners with automatic cleanup, intersection observer support, and conditional event handling. This library helps prevent memory leaks and simplifies the management of event listeners in modern web applications.

## Features

- **Type-safe event listener management** with TypeScript support
- **Automatic cleanup** of event listeners when elements are removed from the DOM
- **Intersection Observer integration** for visibility-based event handling
- **Conditional event listeners** that only fire when specified conditions are met
- **Memory leak prevention** using WeakMap for listener storage
- **DOM mutation monitoring** for automatic listener cleanup
- **Zero dependencies** - just pure TypeScript/JavaScript
- **Chained event handlers** for processing events through multiple steps
- **Custom event support** for application-wide event handling

## Installation

```bash
# Using npm
npm install ts-event-manager

# Using yarn
yarn add ts-event-manager

# Using pnpm
pnpm add ts-event-manager
```

## Usage

### Basic Event Listener

```typescript
import { EventListenerManager } from 'ts-event-manager';

// Create an instance of the event manager
const eventManager = new EventListenerManager();

// Add a click event listener
const button = document.querySelector('#myButton');
eventManager.addListener(button, 'click', () => {
  console.log('Button clicked!');
});
```

### Custom Event Handling

```typescript
// Add a custom event listener
document.addEventListener('userAction', (e: CustomEvent) => {
  const userData = e.detail; // { userId: 123, action: 'profile_update' }
  console.log(`User ${userData.userId} performed ${userData.action}`);
});

// Trigger a custom event with data
interface UserActionData {
  userId: number;
  action: string;
}

eventManager.triggerCustomEvent<UserActionData>('userAction', {
  userId: 123,
  action: 'profile_update'
});
```

### Conditional Event Listener

```typescript
// Add a listener that only fires when a condition is met
let isEnabled = false;

eventManager.addListener(
  button,
  'click',
  () => console.log('Conditional click!'),
  () => isEnabled
);

// The listener will only fire when isEnabled is true
isEnabled = true;
```

### Intersection Observer Integration

```typescript
// Create manager with custom intersection observer options
const eventManager = new EventListenerManager({
  rootMargin: '50px',
  threshold: [0, 0.5, 1]
});

// Add event listener that works with intersection observer
const element = document.querySelector('#myElement');
eventManager.addListener(element, 'mouseenter', () => {
  console.log('Mouse entered visible element!');
});

// The mouseenter event will only fire when the element is visible
// The element will automatically get 'data-visible="true"' when visible
```

### Manual Cleanup

```typescript
// Remove a specific listener
eventManager.removeListener(element, 'click', listener);

// Clean up all listeners
eventManager.cleanUp();
```

## API Reference

### `EventListenerManager`

#### Constructor
```typescript
constructor(intersectionOptions?: IntersectionObserverInit)
```

#### Methods

##### `addListener`
Adds an event listener with optional condition
```typescript
addListener(
  element: Element,
  event: string,
  listener: EventListenerOrEventListenerObject,
  condition?: () => boolean
): void
```

##### `removeListener`
Removes an event listener
```typescript
removeListener(
  element: Element,
  event: string,
  listener: EventListenerOrEventListenerObject
): void
```

##### `cleanUp`
Cleans up all event listeners and observers
```typescript
cleanUp(): void
```

##### `createEventChain`
Creates a new event chain
```typescript
createEventChain<T = any>(
  chainId: string,
  element: Element,
  event: string,
  handlers: ChainedEventHandler<T>[]
): void
```

##### `removeEventChain`
Removes an event chain
```typescript
removeEventChain(chainId: string): void
```

##### `addToChain`
Adds or updates a handler in an existing chain
```typescript
addToChain<T = any>(
  chainId: string,
  handler: ChainedEventHandler<T>,
  position?: number
): void
```

##### `triggerCustomEvent`
Triggers a custom event that can be listened to throughout the application
```typescript
triggerCustomEvent<T = any>(eventName: string, data?: T): void
```

### Types

#### `ChainedEventHandler<T>`
A handler function in an event chain
```typescript
type ChainedEventHandler<T = any> = (
  event: Event,
  data?: T
) => ChainedEventResult<T> | Promise<ChainedEventResult<T>>;
```

#### `ChainedEventResult<T>`
Result from a chained event handler
```typescript
interface ChainedEventResult<T = any> {
  data: T;        // Data to pass to the next handler
  continue: boolean; // Whether to continue the chain
}
```

## License

MIT License - see the full [LICENSE](LICENSE) file for details

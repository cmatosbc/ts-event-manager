# TypeScript Event Manager

[![Node.js CI](https://github.com/cmatosbc/ts-event-manager/actions/workflows/node.js.yml/badge.svg)](https://github.com/cmatosbc/ts-event-manager/actions/workflows/node.js.yml)

A robust TypeScript library for managing DOM event listeners with automatic cleanup, intersection observer support, and conditional event handling. This library helps prevent memory leaks and simplifies the management of event listeners in modern web applications.

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Core Features](#core-features)
  - [Basic Event Listeners](#basic-event-listeners)
  - [Conditional Event Handling](#conditional-event-handling)
  - [Intersection Observer Integration](#intersection-observer-integration)
  - [Event Chains](#event-chains)
  - [Automatic Cleanup](#automatic-cleanup)
  - [Manual Cleanup](#manual-cleanup)
- [Extensions](#extensions)
  - [Debounce](#debounce)
  - [Once](#once)
  - [Error Boundary](#error-boundary)
- [Examples](#examples)
  - [Form Handling](#form-handling)
  - [List Management](#list-management)
- [Best Practices](#best-practices)
- [License](#license)

## Features

- **Type-safe event listener management** with TypeScript support
- **Automatic cleanup** of event listeners when elements are removed from the DOM
- **Intersection Observer integration** for visibility-based event handling
- **Conditional event listeners** that only fire when specified conditions are met
- **Memory leak prevention** using WeakMap for listener storage
- **DOM mutation monitoring** for automatic listener cleanup
- **Zero dependencies** - just pure TypeScript/JavaScript
- **Chained event handlers** for processing events through multiple steps

## Installation

```bash
# Using npm
npm install ts-event-manager

# Using yarn
yarn add ts-event-manager

# Using pnpm
pnpm add ts-event-manager
```

## Core Features

### Basic Event Listeners

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

### Conditional Event Handling

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
```

### Event Chains

```typescript
// Create a chain of event handlers that process data sequentially
eventManager.createEventChain(
  'formChain',
  form,
  'submit',
  [
    (event, data) => ({
      data: { ...data, validated: true },
      continue: true
    }),
    async (event, data) => {
      await saveToServer(data);
      return { data, continue: true };
    }
  ]
);
```

### Automatic Cleanup

The EventListenerManager automatically:
- Removes listeners when elements are removed from the DOM
- Cleans up all listeners when the page unloads
- Manages IntersectionObserver observations
- Removes data attributes when listeners are removed

### Manual Cleanup

```typescript
// Remove a specific listener
eventManager.removeListener(element, 'click', listener);

// Clean up all listeners
eventManager.cleanUp();
```

## Extensions

### Debounce

The debounce extension helps control the rate at which event handlers are called, particularly useful for handling high-frequency events.

```typescript
import { EventListenerManager } from 'ts-event-manager';
import { debounce } from 'ts-event-manager/extensions';

const eventManager = new EventListenerManager();
const searchInput = document.querySelector('#search');

// Debounce search input with 300ms delay
eventManager.addDebouncedListener(
  searchInput,
  'input',
  (event) => {
    console.log('Searching...', event.target.value);
  },
  { delay: 300 }
);
```

### Once

The once extension ensures that an event listener only fires once and then automatically stops listening.

```typescript
import { EventListenerManager } from 'ts-event-manager';
import { once } from 'ts-event-manager/extensions';

const eventManager = new EventListenerManager();
const button = document.querySelector('#myButton');

// This click handler will only fire once
eventManager.addListener(button, 'click', once(() => {
    console.log('This will only happen once!');
}));

// Useful for one-time initialization
eventManager.addListener(document, 'DOMContentLoaded', once(() => {
    initializeApp();
}));
```

### Error Boundary

The Error Boundary extension provides error handling capabilities for event listeners.

```typescript
import { EventListenerManager } from 'ts-event-manager';
import { withErrorBoundary } from 'ts-event-manager/extensions';

const eventManager = new EventListenerManager();
const button = document.querySelector('#myButton');

// Add error handling to event listener
eventManager.addListener(
  button,
  'click',
  withErrorBoundary(() => {
    throw new Error('Something went wrong');
  }, {
    onError: (error) => {
      console.error('Caught error:', error);
    }
  })
);
```

## Examples

### Form Handling

```typescript
const formManager = new EventListenerManager();
const form = document.querySelector('#myForm');

formManager.addListener(form, 'submit', async (event) => {
  event.preventDefault();
  const data = new FormData(form);
  await submitForm(data);
});
```

### List Management

```typescript
class ListManager {
  private manager = new EventListenerManager();
  
  constructor(private list: HTMLElement) {
    this.setupListeners();
  }

  private setupListeners() {
    this.manager.addListener(this.list, 'click', (e) => {
      if (e.target.matches('.delete-btn')) {
        this.handleDelete(e);
      }
    });
  }

  destroy() {
    this.manager.cleanUp();
  }
}
```

## Best Practices

- Use a single EventListenerManager instance per component or module
- Always call cleanUp() when a component is destroyed
- Leverage conditional listeners for dynamic behavior
- Use debounce for high-frequency events
- Implement error boundaries for critical event handlers
- Take advantage of automatic cleanup features

## License

MIT License - see the [LICENSE](LICENSE) file for details

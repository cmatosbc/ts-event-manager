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

### Automatic Cleanup

The EventListenerManager automatically:
- Removes listeners when elements are removed from the DOM
- Cleans up all listeners when the page unloads
- Manages IntersectionObserver observations
- Removes data attributes when listeners are removed

## Real-World Examples

### Infinite Scroll Implementation
```typescript
const eventManager = new EventListenerManager({
  rootMargin: '100px', // Start loading before element is visible
});

class InfiniteScroll {
  private loading = false;
  private page = 1;

  constructor(private container: HTMLElement) {
    // Create and append loading indicator
    const loadingIndicator = document.createElement('div');
    loadingIndicator.id = 'loading';
    loadingIndicator.style.display = 'none';
    container.appendChild(loadingIndicator);

    // Add intersection observer based loader
    eventManager.addListener(
      loadingIndicator,
      'mouseenter', // Using mouseenter as a proxy for visibility
      async () => {
        if (!this.loading) {
          this.loading = true;
          await this.loadMoreContent();
          this.loading = false;
        }
      },
      () => !this.loading // Only trigger if not already loading
    );
  }

  private async loadMoreContent() {
    const response = await fetch(`/api/items?page=${this.page}`);
    const items = await response.json();
    // Append new items to container
    items.forEach(item => {
      const element = createItemElement(item);
      this.container.insertBefore(element, this.container.lastChild);
    });
    this.page++;
  }
}
```

### Lazy-Loading Images
```typescript
const imageManager = new EventListenerManager({
  threshold: [0, 0.1], // Start loading when even slightly visible
});

function setupLazyImages() {
  document.querySelectorAll('img[data-src]').forEach(img => {
    imageManager.addListener(
      img,
      'mouseenter',
      () => {
        const image = img as HTMLImageElement;
        const src = image.getAttribute('data-src');
        if (src) {
          image.src = src;
          image.removeAttribute('data-src');
        }
      },
      () => !img.hasAttribute('src') // Only load if not already loaded
    );
  });
}
```

### Form Validation with Conditional Submit
```typescript
const formManager = new EventListenerManager();

class SmartForm {
  private isValid = false;
  private isDirty = false;

  constructor(private form: HTMLFormElement) {
    // Add input listeners
    form.querySelectorAll('input').forEach(input => {
      formManager.addListener(input, 'input', () => {
        this.isDirty = true;
        this.validate();
      });
    });

    // Add submit listener with condition
    formManager.addListener(
      form,
      'submit',
      (e) => {
        if (!this.isValid) {
          e.preventDefault();
          this.showErrors();
        }
      },
      () => this.isDirty // Only validate if form has been modified
    );
  }

  private validate() {
    // Perform validation
    this.isValid = Array.from(this.form.elements)
      .every(element => (element as HTMLInputElement).validity.valid);
    
    // Update UI
    this.form.classList.toggle('is-valid', this.isValid);
  }

  private showErrors() {
    this.form.classList.add('show-errors');
  }
}
```

### Modal Dialog with Cleanup
```typescript
class Modal {
  private element: HTMLElement;

  constructor(content: string) {
    this.element = document.createElement('div');
    this.element.className = 'modal';
    this.element.innerHTML = `
      <div class="modal-content">
        ${content}
        <button class="close">&times;</button>
      </div>
    `;
  }

  show() {
    document.body.appendChild(this.element);
    
    // Add event listeners that will be automatically cleaned up
    eventManager.addListener(
      this.element.querySelector('.close')!,
      'click',
      () => this.hide()
    );

    // Close on click outside
    eventManager.addListener(
      this.element,
      'click',
      (e) => {
        if (e.target === this.element) {
          this.hide();
        }
      }
    );

    // Close on escape key
    eventManager.addListener(
      document,
      'keydown',
      (e) => {
        if (e instanceof KeyboardEvent && e.key === 'Escape') {
          this.hide();
        }
      }
    );
  }

  hide() {
    // The EventListenerManager will automatically clean up all listeners
    // when the element is removed from the DOM
    this.element.remove();
  }
}
```

### Dynamic Content Management
```typescript
class DynamicList {
  private eventManager = new EventListenerManager();
  private container: HTMLElement;

  constructor(containerId: string) {
    this.container = document.getElementById(containerId)!;
    
    // Add sort functionality
    const sortButtons = this.container.querySelectorAll('.sort-button');
    sortButtons.forEach(button => {
      this.eventManager.addListener(button, 'click', () => {
        const column = button.getAttribute('data-sort');
        if (column) this.sortBy(column);
      });
    });

    // Add filter functionality with debounce
    const filterInput = this.container.querySelector('.filter-input');
    if (filterInput) {
      let timeout: NodeJS.Timeout;
      this.eventManager.addListener(filterInput, 'input', (e) => {
        clearTimeout(timeout);
        timeout = setTimeout(() => {
          const value = (e.target as HTMLInputElement).value;
          this.filterItems(value);
        }, 300);
      });
    }

    // Add drag and drop for items
    this.container.querySelectorAll('.list-item').forEach(item => {
      this.setupDragAndDrop(item as HTMLElement);
    });
  }

  private setupDragAndDrop(item: HTMLElement) {
    this.eventManager.addListener(item, 'dragstart', (e) => {
      if (e instanceof DragEvent) {
        e.dataTransfer?.setData('text/plain', item.id);
        item.classList.add('dragging');
      }
    });

    this.eventManager.addListener(item, 'dragend', () => {
      item.classList.remove('dragging');
    });

    // Conditional drop handling
    this.eventManager.addListener(
      item,
      'drop',
      (e) => {
        if (e instanceof DragEvent) {
          e.preventDefault();
          const draggedId = e.dataTransfer?.getData('text/plain');
          const draggedElement = document.getElementById(draggedId);
          if (draggedElement && this.canDrop(draggedElement, item)) {
            this.handleDrop(draggedElement, item);
          }
        }
      },
      () => this.isDropEnabled // Only allow drops when enabled
    );
  }

  private isDropEnabled = true;
  private canDrop(dragged: HTMLElement, target: HTMLElement): boolean {
    // Implement drop validation logic
    return true;
  }

  private handleDrop(dragged: HTMLElement, target: HTMLElement) {
    // Implement drop handling logic
  }

  private sortBy(column: string) {
    // Implement sorting logic
  }

  private filterItems(value: string) {
    // Implement filtering logic
  }

  // Clean up when removing the list
  public destroy() {
    this.eventManager.cleanUp();
  }
}

// Usage
const list = new DynamicList('dynamic-list');

// When done
list.destroy(); // All event listeners will be cleaned up
```

### Chained Event Handlers

The EventListenerManager supports creating chains of event handlers where the output of one handler becomes the input for the next. This is particularly useful for processing events through multiple steps, such as validation, transformation, and UI updates.

```typescript
import { EventListenerManager, ChainedEventHandler } from 'ts-event-manager';

const manager = new EventListenerManager();

// Define handlers in your chain
const validateInput: ChainedEventHandler<string> = (event, data) => ({
  data: (event.target as HTMLInputElement).value.trim(),
  continue: true
});

const transformInput: ChainedEventHandler<string> = (event, data) => ({
  data: data?.toUpperCase(),
  continue: true
});

const updateUI: ChainedEventHandler<string> = (event, data) => {
  // Store or use the processed data
  const output = document.getElementById('output');
  if (output) {
    output.textContent = data || '';
  }
  return { data, continue: true };
};

// Get input element and create the chain
const input = document.querySelector('input');
if (input) {
  manager.createEventChain(
    'input-chain',          // unique chain ID
    input,                  // DOM element
    'input',               // event type
    [validateInput, transformInput, updateUI]  // array of handlers
  );
}

// Example: Conditional chain handling
const validateWithCondition: ChainedEventHandler<string> = (event, data) => ({
  data: (event.target as HTMLInputElement).value.trim(),
  continue: (event.target as HTMLInputElement).value.length > 0  // only continue if input is not empty
});

// Add a handler to an existing chain
const logHandler: ChainedEventHandler<string> = (event, data) => {
  console.log('Processed input:', data);
  return { data, continue: true };
};

manager.addToChain('input-chain', logHandler);

// Remove the chain when no longer needed
manager.removeEventChain('input-chain');
```

Each handler in the chain:
- Receives the event object and the data from the previous handler
- Must return an object with:
  - `data`: The processed data to pass to the next handler
  - `continue`: Boolean indicating whether to continue the chain
- Can be async for handling asynchronous operations
- Can break the chain by returning `continue: false`

Common use cases for chained events:
- Form validation and processing
- Multi-step data transformations
- Input sanitization and formatting
- Event logging and monitoring
- Complex UI interactions with multiple steps

## Extensions

The library provides optional extensions for advanced event handling:

### Timing Extension (Debounce/Throttle)

```typescript
import { withTiming } from 'ts-event-manager/extensions';

const timedManager = withTiming(eventManager);
timedManager.addTimedListener(
    window,
    'scroll',
    (event) => console.log('Scrolled!'),
    { delay: 200 }
);
```

### Event Delegation Extension

```typescript
import { withDelegation } from 'ts-event-manager/extensions';

const delegatedManager = withDelegation(eventManager);
delegatedManager.addDelegatedListener(
    document.querySelector('.container'),
    'click',
    { selector: '.button' },
    (event, target) => console.log('Button clicked:', target)
);
```

## Development

### Prerequisites

- Node.js (v14 or higher)
- pnpm (or npm/yarn)

### Setup

1. Clone the repository:
```bash
git clone https://github.com/cmatosbc/ts-event-manager.git
cd ts-event-manager
```

2. Install dependencies:
```bash
pnpm install
```

3. Build the package:
```bash
pnpm build
```

### Testing

The package uses Playwright for end-to-end testing:

```bash
# Run all tests
pnpm test

# Run tests with UI
pnpm test:ui
```

### Scripts

- `pnpm build` - Build the TypeScript source
- `pnpm test` - Run all tests
- `pnpm test:ui` - Run tests with UI
- `pnpm lint` - Lint the source code
- `pnpm format` - Format the source code

## API Reference

### `EventListenerManager`

#### Constructor
```typescript
constructor(intersectionOptions?: IntersectionObserverInit)
```

#### Methods

##### `addListener`
```typescript
addListener(
  element: Element,
  event: string,
  listener: EventListenerOrEventListenerObject,
  condition?: () => boolean
): void
```

##### `removeListener`
```typescript
removeListener(
  element: Element,
  event: string,
  listener: EventListenerOrEventListenerObject
): void
```

##### `cleanUp`
```typescript
cleanUp(): void
```

##### `createEventChain`
Creates a new chain of event handlers.
```typescript
createEventChain<T>(
  chainId: string,
  element: Element,
  event: string,
  handlers: ChainedEventHandler<T>[]
): void
```

##### `addToChain`
Adds a new handler to an existing chain.
```typescript
addToChain<T>(
  chainId: string,
  handler: ChainedEventHandler<T>,
  position?: number
): void
```

##### `removeEventChain`
Removes an entire event chain.
```typescript
removeEventChain(chainId: string): void
```

### `ChainedEventHandler<T>`

A type representing a handler function in an event chain.

```typescript
type ChainedEventHandler<T = any> = (
  event: Event,
  data?: T
) => ChainedEventResult<T> | Promise<ChainedEventResult<T>>;

interface ChainedEventResult<T = any> {
  data: T;        // Data to pass to the next handler
  continue: boolean; // Whether to continue the chain
}
```

## License

MIT License - see the [LICENSE](LICENSE) file for details

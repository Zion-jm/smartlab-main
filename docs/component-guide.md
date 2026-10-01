# SmartLab Component Guide

## 🎯 Component Architecture

SmartLab uses a **component-based architecture** to ensure reusability, maintainability, and consistency across all panels.

## 📦 Component Structure

Each component follows this structure:
```
ComponentName/
├── ComponentName.js          # Main component logic
├── ComponentName.css         # Component-specific styles
├── ComponentName.test.js     # Component tests
├── examples/                # Usage examples
│   ├── basic.html
│   └── advanced.html
└── index.js                 # Export file
```

## 🎨 Base Component Class

All components extend the base `Component` class:

```javascript
class Component {
  constructor(element, options = {}) {
    this.element = element;
    this.options = { ...this.defaultOptions, ...options };
    this.state = {};
    this.listeners = new Map();
    this.isInitialized = false;
  }

  // Default options that can be overridden
  get defaultOptions() {
    return {
      responsive: true,
      autoInit: true,
      debug: false
    };
  }

  // Initialize the component
  init() {
    if (this.isInitialized) return;
    
    this.log('Initializing component');
    this.setupEventListeners();
    this.render();
    this.isInitialized = true;
  }

  // Render the component (override in subclasses)
  render() {
    throw new Error('render() method must be implemented');
  }

  // Setup event listeners (override in subclasses)
  setupEventListeners() {
    // Override in subclasses
  }

  // Update component state
  setState(updates) {
    const oldState = { ...this.state };
    this.state = { ...this.state, ...updates };
    this.onStateChange(oldState, this.state);
  }

  // Handle state changes (override in subclasses)
  onStateChange(oldState, newState) {
    // Override in subclasses
  }

  // Add event listener with cleanup
  addEventListener(element, event, handler, options = {}) {
    const wrappedHandler = handler.bind(this);
    element.addEventListener(event, wrappedHandler, options);
    
    // Store for cleanup
    this.listeners.set(handler, { element, event, wrappedHandler });
  }

  // Remove all event listeners
  removeEventListeners() {
    this.listeners.forEach(({ element, event, wrappedHandler }, handler) => {
      element.removeEventListener(event, wrappedHandler);
    });
    this.listeners.clear();
  }

  // Destroy component
  destroy() {
    this.log('Destroying component');
    this.removeEventListeners();
    this.isInitialized = false;
  }

  // Logging helper
  log(message, level = 'info') {
    if (this.options.debug) {
      console[level](`[${this.constructor.name}] ${message}`);
    }
  }
}
```

## 🧩 Core Components

### 1. Header Component

**Purpose**: Top navigation bar with logo, navigation, and user actions

**Features**:
- Responsive design with mobile menu
- Breadcrumb navigation
- User profile dropdown
- Notification system
- Search functionality

**Props**:
```javascript
{
  title: 'SmartLab',
  showBreadcrumb: true,
  showNotifications: true,
  showSearch: false,
  user: null,
  onMenuToggle: () => {},
  onNotificationClick: () => {}
}
```

**Usage**:
```javascript
import { Header } from './components/Header';

const header = new Header(document.querySelector('.header'), {
  title: 'SmartLab Admin',
  showBreadcrumb: true,
  user: currentUser,
  onMenuToggle: () => toggleSidebar()
});
```

### 2. Sidebar Component

**Purpose**: Main navigation sidebar with menu items and user info

**Features**:
- Collapsible design
- Active state highlighting
- Mobile overlay
- Smooth animations
- Keyboard navigation

**Props**:
```javascript
{
  items: [],
  collapsed: false,
  user: null,
  onItemClick: (item) => {},
  onToggle: (collapsed) => {}
}
```

**Menu Items Structure**:
```javascript
const menuItems = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: '🏠',
    href: '/admin/dashboard',
    active: true
  },
  {
    id: 'schedule',
    label: 'Schedule',
    icon: '📅',
    href: '/admin/schedule',
    badge: 3
  }
];
```

### 3. Table Component

**Purpose**: Reusable data table with sorting, filtering, and pagination

**Features**:
- Sortable columns
- Search/filter functionality
- Pagination
- Responsive design
- Row selection
- Export options

**Props**:
```javascript
{
  data: [],
  columns: [],
  sortable: true,
  filterable: true,
  paginated: true,
  pageSize: 10,
  onSort: (column, direction) => {},
  onFilter: (filters) => {},
  onPageChange: (page) => {}
}
```

**Columns Structure**:
```javascript
const columns = [
  {
    key: 'name',
    label: 'Name',
    sortable: true,
    filterable: true,
    render: (value) => `<strong>${value}</strong>`
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (value) => `<span class="status-${value}">${value}</span>`
  }
];
```

### 4. Modal Component

**Purpose**: Reusable modal dialog for forms and confirmations

**Features**:
- Multiple sizes (small, medium, large)
- Backdrop click to close
- ESC key to close
- Focus management
- Animation effects

**Props**:
```javascript
{
  title: 'Modal Title',
  size: 'medium',
  closable: true,
  showCloseButton: true,
  onClose: () => {},
  onConfirm: () => {}
}
```

### 5. Form Component

**Purpose**: Reusable form with validation and submission

**Features**:
- Field validation
- Error handling
- Loading states
- Auto-save functionality
- Multi-step forms

**Props**:
```javascript
{
  fields: [],
  values: {},
  validation: {},
  onSubmit: (values) => {},
  onChange: (values) => {},
  loading: false
}
```

## 🎨 Styling Guidelines

### CSS Custom Properties
Each component uses CSS custom properties for theming:

```css
.component {
  --component-bg: var(--color-background);
  --component-border: var(--color-border);
  --component-text: var(--color-text-primary);
  --component-padding: var(--spacing-4);
  --component-radius: var(--radius-md);
}
```

### Responsive Classes
Components use consistent responsive class patterns:

```css
.component {
  /* Base styles */
}

.component--mobile {
  /* Mobile-specific styles */
}

.component--tablet {
  /* Tablet-specific styles */
}

.component--desktop {
  /* Desktop-specific styles */
}
```

### State Classes
Components use state classes for different conditions:

```css
.component {
  /* Default state */
}

.component--active {
  /* Active state */
}

.component--disabled {
  /* Disabled state */
}

.component--loading {
  /* Loading state */
}
```

## 🧪 Testing Components

### Unit Test Template
```javascript
import { Component } from './Component';

describe('Component', () => {
  let element;
  let component;

  beforeEach(() => {
    element = document.createElement('div');
    document.body.appendChild(element);
    component = new Component(element);
  });

  afterEach(() => {
    component.destroy();
    document.body.removeChild(element);
  });

  describe('initialization', () => {
    it('should initialize without errors', () => {
      expect(() => component.init()).not.toThrow();
    });

    it('should render default content', () => {
      component.init();
      expect(element.innerHTML).toContain('expected-content');
    });
  });

  describe('functionality', () => {
    it('should handle user interactions', () => {
      component.init();
      const button = element.querySelector('.component-button');
      button.click();
      expect(component.state.isActive).toBe(true);
    });
  });

  describe('responsive behavior', () => {
    it('should adapt to mobile viewport', () => {
      component.init();
      // Simulate mobile viewport
      window.innerWidth = 500;
      window.dispatchEvent(new Event('resize'));
      expect(element.classList.contains('component--mobile')).toBe(true);
    });
  });
});
```

### Integration Test Template
```javascript
describe('Component Integration', () => {
  it('should work with other components', () => {
    const container = document.createElement('div');
    document.body.appendChild(container);
    
    // Initialize multiple components
    const header = new Header(container.querySelector('.header'));
    const sidebar = new Sidebar(container.querySelector('.sidebar'));
    
    header.init();
    sidebar.init();
    
    // Test interaction
    const menuButton = header.element.querySelector('.menu-toggle');
    menuButton.click();
    
    expect(sidebar.state.isOpen).toBe(true);
  });
});
```

## 🔄 Component Lifecycle

1. **Construction**: `new Component(element, options)`
2. **Initialization**: `component.init()`
3. **Rendering**: `component.render()` (called automatically)
4. **State Updates**: `component.setState(newState)`
5. **Event Handling**: Automatic via `setupEventListeners()`
6. **Destruction**: `component.destroy()`

## 📋 Best Practices

### ✅ Do This
- **Extend base Component class**
- **Use consistent naming conventions**
- **Implement proper cleanup**
- **Write comprehensive tests**
- **Document props and methods**
- **Handle edge cases**
- **Use semantic HTML**
- **Follow accessibility guidelines**

### ❌ Avoid This
- **Direct DOM manipulation** outside render()
- **Global state pollution**
- **Memory leaks** (unremoved listeners)
- **Hard-coded values**
- **Inconsistent naming**
- **Skipping tests**
- **Ignoring accessibility**

## 🚀 Creating New Components

### Step-by-Step Process

1. **Create component directory**
   ```bash
   mkdir src/components/NewComponent
   ```

2. **Create component files**
   ```bash
   touch src/components/NewComponent/{NewComponent.js,NewComponent.css,NewComponent.test.js,index.js}
   ```

3. **Implement component class**
   ```javascript
   import { Component } from '../shared/Component';
   
   export class NewComponent extends Component {
     render() {
       this.element.innerHTML = `
         <div class="new-component">
           <!-- Component content -->
         </div>
       `;
     }
   }
   ```

4. **Add component styles**
   ```css
   .new-component {
     padding: var(--spacing-4);
     border: 1px solid var(--color-border);
     border-radius: var(--radius-md);
   }
   ```

5. **Write tests**
   ```javascript
   import { NewComponent } from './NewComponent';
   
   describe('NewComponent', () => {
     // Test implementation
   });
   ```

6. **Create examples**
   ```html
   <!DOCTYPE html>
   <html>
   <head>
     <link rel="stylesheet" href="./NewComponent.css">
   </head>
   <body>
     <div class="new-component"></div>
     <script src="./NewComponent.js"></script>
   </body>
   </html>
   ```

7. **Export component**
   ```javascript
   export { NewComponent } from './NewComponent';
   ```

---

*For more information, see [development-guide.md](./development-guide.md)*

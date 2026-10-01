# SmartLab Development Guide

## 🎯 Project Overview
A clean, maintainable, and scalable lab management system built with modern web technologies.

## 📁 Project Structure
```
smartlab-api/
├── src/                          # Source code
│   ├── components/                 # Reusable UI components
│   │   ├── Header/
│   │   │   ├── Header.js
│   │   │   ├── Header.css
│   │   │   └── index.js
│   │   ├── Sidebar/
│   │   ├── Table/
│   │   ├── Modal/
│   │   └── shared/                 # Shared component utilities
│   ├── pages/                      # Page-specific logic
│   │   ├── admin/
│   │   ├── faculty/
│   │   └── student/
│   ├── hooks/                      # Custom hooks (if using React)
│   ├── utils/                      # Helper functions
│   ├── services/                   # API calls & data fetching
│   ├── styles/                     # Global styles
│   │   ├── tokens.css              # Design tokens
│   │   ├── base.css               # Base styles
│   │   ├── components.css          # Component styles
│   │   └── utilities.css          # Utility classes
│   └── main.js                     # Application entry point
├── public/                        # Static assets
│   ├── images/
│   ├── fonts/
│   └── index.html
├── docs/                          # Documentation
│   ├── development-guide.md
│   ├── component-guide.md
│   └── deployment-guide.md
├── tests/                         # Test files
└── package.json                   # Dependencies & scripts
```

## 🛠️ Technology Stack

### Frontend
- **Build Tool**: Vite (fast, modern)
- **Framework**: React 18 + TypeScript
- **CSS Framework**: Tailwind CSS (utility-first)
- **State Management**: Zustand (simple, lightweight)
- **Routing**: React Router
- **Testing**: Jest + Testing Library

### Backend (Ultra-Lightweight)
```
Node.js + Express + TypeScript
├── Prisma ORM (Database)
├── PostgreSQL (Database)
├── JWT (Authentication)
├── bcryptjs (Password hashing)
├── cors (Cross-origin requests)
├── helmet (Security headers)
└── dotenv (Environment variables)
```

### Database (Optimized Schema)
- **Provider**: PostgreSQL
- **ORM**: Prisma
- **Schema**: Ultra-lightweight (17 tables)
- **Features**:
  - Hybrid User/Profile structure
  - Smart equipment inventory tracking
  - Full academic context (years, terms, programs, subjects)
  - Complete borrow request workflow
  - Notification & audit systems

## 🎨 Design System

### Color Palette
```css
:root {
  --color-primary: #800000;      /* Maroon */
  --color-secondary: #FFB81C;    /* Gold */
  --color-accent: #0066CC;      /* Blue */
  --color-success: #10B981;      /* Green */
  --color-warning: #F59E0B;      /* Orange */
  --color-error: #EF4444;        /* Red */
  --color-neutral: #6B7280;      /* Gray */
}
```

### Typography
```css
:root {
  --font-family: 'Inter', system-ui, sans-serif;
  --font-size-xs: 0.75rem;      /* 12px */
  --font-size-sm: 0.875rem;     /* 14px */
  --font-size-base: 1rem;       /* 16px */
  --font-size-lg: 1.125rem;     /* 18px */
  --font-size-xl: 1.25rem;       /* 20px */
  --font-size-2xl: 1.5rem;      /* 24px */
}
```

### Spacing
```css
:root {
  --spacing-1: 0.25rem;   /* 4px */
  --spacing-2: 0.5rem;    /* 8px */
  --spacing-3: 0.75rem;   /* 12px */
  --spacing-4: 1rem;      /* 16px */
  --spacing-5: 1.25rem;   /* 20px */
  --spacing-6: 1.5rem;    /* 24px */
  --spacing-8: 2rem;      /* 32px */
  --spacing-10: 2.5rem;   /* 40px */
  --spacing-12: 3rem;     /* 48px */
}
```

### Breakpoints
```css
:root {
  --breakpoint-sm: 640px;    /* Small mobile */
  --breakpoint-md: 768px;    /* Tablet */
  --breakpoint-lg: 1024px;   /* Desktop */
  --breakpoint-xl: 1280px;   /* Large desktop */
}
```

## 📱 Responsive Strategy

### Mobile-First Approach
1. **Design for mobile first** (320px - 767px)
2. **Progressively enhance** for tablet (768px - 1023px)
3. **Optimize for desktop** (1024px+)

### Container Queries (Modern)
```css
.component {
  container-type: inline-size;
}

@container (min-width: 768px) {
  .component {
    /* Tablet styles */
  }
}
```

## 🔄 State Management

### Simple State Pattern
```javascript
class StateManager {
  constructor() {
    this.state = {
      user: null,
      sidebarOpen: false,
      currentView: 'dashboard',
      notifications: []
    };
    this.listeners = [];
  }
  
  setState(updates) {
    this.state = { ...this.state, ...updates };
    this.notifyListeners();
  }
  
  subscribe(listener) {
    this.listeners.push(listener);
  }
  
  notifyListeners() {
    this.listeners.forEach(listener => listener(this.state));
  }
}
```

## 🧪 Testing Strategy

### Unit Tests
- Component behavior
- Utility functions
- State management

### Integration Tests
- User workflows
- API integration

### E2E Tests
- Critical user paths
- Cross-browser compatibility

## 🚀 Development Workflow

### 1. Setup
```bash
npm create vite@latest smartlab-frontend
cd smartlab-frontend
npm install -D tailwindcss postcss autoprefixer
npm install -D @testing-library/jest-dom jest
```

### 2. Development
```bash
npm run dev          # Start dev server
npm run test          # Run tests
npm run lint          # Check code quality
npm run build         # Build for production
```

### 3. Git Workflow
```bash
git checkout -b feature/new-component
# Make changes
git add .
git commit -m "feat: add new component"
git push origin feature/new-component
# Create pull request
```

## 📋 Code Standards

### CSS
- Use **Tailwind utilities** first
- Create **custom components** only when necessary
- Follow **mobile-first** responsive design
- Use **CSS custom properties** for theming

### JavaScript
- Use **ES6+** features
- Follow **functional programming** where possible
- Write **self-documenting** code
- Handle **errors gracefully**

### File Naming
- **Components**: PascalCase (Header.js)
- **Utilities**: camelCase (formatDate.js)
- **Files**: kebab-case (user-profile.html)
- **CSS**: kebab-case (header-component.css)

## 📚 Documentation Standards

### Component Documentation
Each component needs:
1. **Purpose** - What it does
2. **Props** - What it accepts
3. **Usage** - How to use it
4. **Examples** - Code examples

### API Documentation
Each API endpoint needs:
1. **Endpoint** - URL and method
2. **Parameters** - Request parameters
3. **Response** - Response format
4. **Errors** - Possible errors

## 🔧 Performance Guidelines

### CSS
- **Minimize repaints**
- Use **transform** and **opacity** for animations
- **Lazy load** images
- **Optimize fonts**

### JavaScript
- **Debounce** events
- **Lazy load** components
- **Use requestAnimationFrame**
- **Optimize bundle size**

## 🚨 Troubleshooting

### Common Issues
1. **Sidebar not responsive** → Check breakpoint classes
2. **Styles not applying** → Verify CSS import order
3. **State not updating** → Check subscription pattern
4. **Build failing** → Check dependencies and syntax

### Debug Tools
- **Browser DevTools** → Inspect elements, network, console
- **React DevTools** → Component state (if using React)
- **Lighthouse** → Performance audit
- **ESLint** → Code quality

## 📈 Future Enhancements

### Phase 2
- [ ] **React migration** (optional)
- [ ] **TypeScript** (optional)
- [ ] **PWA features**
- [ ] **Real-time updates**

### Phase 3
- [ ] **Advanced analytics**
- [ ] **A/B testing**
- [ ] **Internationalization**
- [ ] **Accessibility improvements**

---

## 🎯 Quick Start Checklist

- [ ] **Setup build system** (Vite)
- [ ] **Install Tailwind CSS**
- [ ] **Create design tokens**
- [ ] **Build base components**
- [ ] **Setup state management**
- [ ] **Create basic routing**
- [ ] **Add testing setup**
- [ ] **Configure deployment**

---

*Last updated: 2024-03-11*
*Version: 1.0.0*

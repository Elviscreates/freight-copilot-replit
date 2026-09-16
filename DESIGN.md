# Freight Copilot — Design System

## Design Philosophy
**Dark Glassmorphism Control Room** — A dense, high-contrast dashboard for freight dispatch operations. Every pixel serves the operator. No decorative fluff.

---

## Color System (HSL)

### Base Palette
```css
/* Root variables — defined in index.css :root */
--background:     222 14% 10%;   /* #292c33 — Deep navy base */
--foreground:     210 17% 90%;   /* #dce1e6 — Primary text */
--border:         220 11% 20%;   /* #3a3e45 — Subtle borders */
--input:          220 11% 20%;   /* Input backgrounds */
--ring:           32  92% 54%;   /* #ff8918 — Focus/accent ring */
--card:           222 13% 14%;   /* #24272d — Card surfaces */
--card-foreground: 210 17% 90%;  /* Card text */
```

### Semantic Colors
```css
--primary:        32  92% 54%;   /* Amber — primary actions, highlights */
--primary-foreground: 222 20% 8%;  /* On-primary text */

--secondary:      220 11% 17%;   /* Secondary surfaces */
--secondary-foreground: 210 16% 87%;

--muted:          220 11% 15%;   /* Muted surfaces */
--muted-foreground: 216 8% 55%;  /* Muted text */

--accent:         32  92% 54%;   /* Accent = primary */
--accent-foreground: 222 20% 8%;

--destructive:    4   69% 63%;   /* Red — reject/danger */
--destructive-foreground: 0 0% 100%;
```

### Status Colors
```css
--status-pending:   32  92% 54%;  /* Amber — pending review */
--status-approved:  142 76% 36%;  /* Green — dispatched */
--status-rejected:  4   69% 63%;  /* Red — rejected */
```

### Glassmorphism Layer
```css
/* Card surface: rgba with 1px border */
background: hsl(var(--card)) / 0.9;
border: 1px solid hsl(var(--border));
backdrop-filter: blur(8px);  /* Optional enhancement */
```

---

## Typography

### Font Families
```css
--font-sans: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
--font-mono: 'Space Mono', ui-monospace, SFMono-Regular, monospace;
```

### Scale
| Role | Size | Weight | Family | Use Case |
|------|------|--------|--------|----------|
| Page Title | 22px | 600 | Sans | Section headers |
| Section Title | 12px | 600 | Sans | Panel headers |
| Body | 10-11px | 400/500 | Sans | Default text |
| Mono Small | 7-8px | 400 | Mono | Labels, captions |
| Mono Medium | 9-11px | 600/700 | Mono | Values, metrics |
| Mono Large | 17-22px | 700 | Mono | Dashboard numbers |

### Letter Spacing
- Tight headlines: `-0.045em` to `-0.07em`
- Mono labels: `+0.07em` to `+0.16em` (uppercase)

---

## Spacing & Sizing

### Base Unit: 1px (dense control room)
- Button height: 31px
- Input height: 29-31px
- Sidebar rail: 78px
- Topbar height: 58px
- Border radius: 3px (sm), 4px (md), 5px (default), 6px (lg)

---

## Components

### Buttons
```css
/* Primary — approve actions */
.fc-button.primary {
  background: hsl(var(--primary));
  color: hsl(var(--primary-foreground));
  border-color: #73c993;  /* Lighter green border */
}

/* Danger — reject actions */
.fc-button.danger {
  background: #382526;
  color: #ee9b94;
  border-color: #754341;
}

/* Ghost — secondary actions */
.fc-button.ghost {
  background: transparent;
  border-color: transparent;
}
```

**States**: Hover = translateY(-1px) + brighter, Active = translateY(0), Disabled = opacity 0.42

### Cards / Panels
```css
.fc-panel {
  background: #2b2e34;
  border: 1px solid #454a52;
  border-radius: 5px;
}
```

### Form Inputs
```css
.fc-textarea, .fc-search input, .fc-select {
  background: #1f2227;
  border: 1px solid #4a5057;
  color: #d0d5d9;
}
.fc-textarea:focus { border-color: #d2782d; background: #22262b; }
```

### Status Badges
```css
.fc-status.pending   { color: #ffc076; background: #4a3321; }
.fc-status.approved  { color: #8cdda2; background: #254532; }
.fc-status.rejected  { color: #ef9b94; background: #492a2b; }
```

---

## Animations

### CSS Keyframes
```css
@keyframes fc-pulse {
  0%, 100% { opacity: .65; transform: scale(.9); }
  50%      { opacity: 1;   transform: scale(1); }
}

@keyframes fc-shimmer {
  100% { transform: translateX(100%); }
}

@keyframes fc-toast-in {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Usage
- `.fc-live-dot` → `fc-pulse` (2.2s ease-in-out infinite)
- `.fc-skeleton::after` → `fc-shimmer` (1.3s infinite)
- `.fc-toast` → `fc-toast-in` (0.2s ease-out)

### Transitions
```css
/* Standard interactive transition */
transition: background .15s, border-color .15s, color .15s, transform .15s;
```

---

## Layout Architecture

### Fixed Chrome
| Element | Size | Position |
|---------|------|----------|
| Topbar | 58px | `fixed; top: 0; left: 78px; right: 0; z-index: 20` |
| Sidebar | 78px | `fixed; inset: 0 auto 0 0; z-index: 30` |
| Main Canvas | fluid | `margin-left: 78px; padding-top: 58px` |

### Grid Systems
- **Metric Ribbon**: 3-col equal `repeat(3, minmax(0, 1fr))`
- **Overview Grid**: `minmax(0, 1.27fr) minmax(300px, .73fr)`
- **Workspace**: `minmax(265px, 33%) minmax(0, 1fr)`
- **Detail Grid**: `minmax(0, 1.04fr) minmax(270px, .96fr)`
- **Subpage Grid**: `minmax(0, 1.4fr) minmax(280px, .6fr)`

### Responsive Breakpoints
| Breakpoint | Changes |
|------------|---------|
| ≤1120px | Hide brand kicker & live badge; compress grids |
| ≤920px  | Subpage stacks to 1col |
| ≤800px  | Sidebar → bottom bar; topbar full-width; workspace stacks; metric ribbon stacks |
| ≤500px  | Hide global search; compact padding; 2-col summary grid |

---

## Motion & Interaction

### Hover/Tap Feedback
- Buttons: `translateY(-1px)` + border/background brighten
- Nav items: `translateX(1px)` + border/background
- Load cards: background shift
- Overview loads: `padding-left: 19px` + background

### Focus Visible
```css
button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
  outline: 2px solid rgba(255, 137, 24, .8);
  outline-offset: 2px;
}
```

### Loading States
- Skeleton screens with shimmer (`fc-skeleton`)
- Full-page loading grid matching workspace layout
- 30s polling fallback indicator

---

## Iconography
- **Library**: lucide-react
- **Sizes**: 13px (topbar), 14px (search), 15px (nav), 16-17px (detail), 22px (empty states)
- **Stroke**: 2px, round caps/joins
- **Color**: Inherits `currentColor` (foreground/muted)

---

## Accessibility
- Semantic HTML (`<header>`, `<main>`, `<aside>`, `<section>`, `<button>`)
- ARIA labels on icon-only buttons
- `focus-visible` rings on all interactives
- Color contrast ≥ 4.5:1 on text
- `data-testid` attributes for testing hooks

---

## Asset References
- Brand mark: `/branding/freight-copilot-mark.png` (used in topbar + sidebar)
- Favicon: `/favicon.svg`
- Fonts: Google Fonts (DM Sans, Space Mono) with `preconnect`

---

## Design Tokens Export (for external use)
```json
{
  "colors": {
    "background": "#292c33",
    "card": "#24272d",
    "border": "#3a3e45",
    "primary": "#ff8918",
    "success": "#22c55e",
    "destructive": "#ef4444",
    "foreground": "#dce1e6",
    "muted": "#8b929a"
  },
  "fonts": {
    "sans": "DM Sans",
    "mono": "Space Mono"
  },
  "radius": {
    "sm": "3px",
    "md": "4px",
    "lg": "5px",
    "xl": "6px"
  },
  "spacing": {
    "unit": "1px"
  }
}
```
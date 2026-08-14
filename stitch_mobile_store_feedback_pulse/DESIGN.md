---
name: Obsidian Feedback Intelligence
colors:
  surface: '#0d1513'
  surface-dim: '#0d1513'
  surface-bright: '#323b38'
  surface-container-lowest: '#08100e'
  surface-container-low: '#151d1b'
  surface-container: '#19211f'
  surface-container-high: '#232c29'
  surface-container-highest: '#2e3734'
  on-surface: '#dbe5e0'
  on-surface-variant: '#b9cac4'
  inverse-surface: '#dbe5e0'
  inverse-on-surface: '#2a3230'
  outline: '#83948f'
  outline-variant: '#3a4a46'
  surface-tint: '#00dfc1'
  primary: '#d7fff3'
  on-primary: '#00382f'
  primary-container: '#00f5d4'
  on-primary-container: '#006c5c'
  inverse-primary: '#006b5b'
  secondary: '#c8c6c5'
  on-secondary: '#313030'
  secondary-container: '#4a4949'
  on-secondary-container: '#bab8b7'
  tertiary: '#f9f5f5'
  on-tertiary: '#313030'
  tertiary-container: '#dcd9d8'
  on-tertiary-container: '#605f5e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#26fedc'
  primary-fixed-dim: '#00dfc1'
  on-primary-fixed: '#00201a'
  on-primary-fixed-variant: '#005144'
  secondary-fixed: '#e5e2e1'
  secondary-fixed-dim: '#c8c6c5'
  on-secondary-fixed: '#1c1b1b'
  on-secondary-fixed-variant: '#474646'
  tertiary-fixed: '#e5e2e1'
  tertiary-fixed-dim: '#c9c6c5'
  on-tertiary-fixed: '#1c1b1b'
  on-tertiary-fixed-variant: '#474646'
  background: '#0d1513'
  on-background: '#dbe5e0'
  surface-variant: '#2e3734'
typography:
  display-lg:
    fontFamily: Outfit
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  display-lg-mobile:
    fontFamily: Outfit
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Outfit
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  headline-sm:
    fontFamily: Outfit
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-desktop: 40px
  margin-mobile: 20px
---

## Brand & Style

The design system is engineered for high-end feedback analysis, catering to product leaders and data scientists who require a focused, sophisticated environment. The brand personality is authoritative yet ethereal, blending the precision of technical tools with the premium feel of a luxury digital workspace.

The visual direction utilizes a **refined Glassmorphism** approach set against a deep, obsidian-based dark mode. The UI should evoke a sense of depth and clarity, using high-quality background blurs (32px+) and ultra-thin, low-opacity borders to define space. High-contrast elements are reserved for data visualization and critical calls to action, ensuring the interface feels modern, "tech-forward," and incredibly premium.

## Colors

The palette is anchored in true obsidian tones. The background architecture uses `#0a0a0a` for the base canvas and `#121212` for primary containers. 

The primary accent is a vibrant but sophisticated Cyan-to-Emerald gradient, signifying intelligence and growth. Critical data points use a soft Crimson, while warnings leverage a muted Amber. Neutral text follows a tiered grayscale to maintain hierarchy without sacrificing readability against the dark backdrop. Surfaces should use a 60-80% opacity to allow for glassmorphic stacking effects.

## Typography

This design system uses a dual-font strategy to balance character with utility. **Outfit** is used for all headings and display text, providing a geometric, modern tech aesthetic. **Inter** is utilized for all body, table, and UI-action text to ensure maximum legibility at small sizes during intensive data analysis.

Apply a subtle `text-shadow: 0 0 12px rgba(0, 245, 212, 0.3)` to primary display headers to create a "glowing" tech effect. All labels and secondary headings should maintain high contrast (at least 7:1) against the dark background.

## Layout & Spacing

The layout follows a strict **12-column fluid grid** for desktop, optimized for data-heavy dashboards. On tablets, the grid shifts to 8 columns, and on mobile, it collapses to a single-column stack with condensed vertical spacing.

Spacing is based on an 8px rhythmic scale. Use generous padding (32px-48px) within glass containers to allow the "air" of the design system to breathe. Data tables should use a "Compact" mode with 12px vertical cell padding to maximize information density while maintaining a premium feel.

## Elevation & Depth

Hierarchy is established through **Tonal Stacking** and **Backdrop Blurs**.
1. **Level 0 (Canvas):** `#0a0a0a` - The infinite base.
2. **Level 1 (Panels):** `#121212` with 80% opacity and 40px Backdrop Blur. 1px stroke of `rgba(255,255,255,0.08)`.
3. **Level 2 (Modals/Popovers):** `#1a1a1a` with 90% opacity and 60px Backdrop Blur. Subtle outer glow using primary color at 5% opacity.

Shadows should be "Ambient" - extremely diffused with 0% spread and a large 40px-60px blur radius, using a slightly tinted dark shadow `rgba(0,0,0,0.8)` to avoid "grey-smearing" on deep black backgrounds.

## Shapes

The shape language is "Soft-Modern." The standard radius is 0.5rem (8px), providing a professional and structured appearance. For larger components like high-level dashboard cards, use `rounded-xl` (24px) to emphasize the glassmorphic "floating" effect. Buttons and input fields should remain at the standard 8px to maintain a technical, precise feel.

## Components

### Buttons
Primary buttons use the Cyan-Emerald gradient with white text. Hover states should trigger a 2px expansion of a soft cyan outer glow. Secondary buttons use a "Ghost" style: 1px border of `rgba(255,255,255,0.2)` with a subtle blur background.

### Cards
Cards are the primary data containers. They must feature a 1px top-light border `rgba(255,255,255,0.1)` and a 1px side/bottom border `rgba(255,255,255,0.05)`. On hover, cards should lift slightly (-4px Y-axis) and the border opacity should increase to 0.2.

### Input Fields
Inputs are dark-filled `#050505` with a subtle inset shadow to create a "pressed into the glass" effect. On focus, the border transitions to the primary cyan with a 4px outer glow.

### Chips & Badges
Feedback sentiment chips should use low-saturation versions of the status colors (Crimson/Emerald) with 10% opacity backgrounds and 100% opacity text for high legibility without distracting from the primary data.

### Micro-animations
All transitions (hover, focus, page entry) must use a `cubic-bezier(0.16, 1, 0.3, 1)` easing function for a "snappy yet smooth" high-end feel. Use "Skeleton" loaders with a shimmering gradient for data fetching states.
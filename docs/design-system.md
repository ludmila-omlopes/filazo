# Filazo Design System

Filazo should feel like a personal game catalog: calm, adult, legible, editorial, collected, and unhurried. The product should feel closer to a reading room, archive card, or well-kept media shelf than to an AI productivity console.

It should not feel neon, cyberpunk, arcade, childish, corporate, beige SaaS, completionist, or task-manager-like.

## Product Identity

Filazo helps players live with a large library without turning play into a quota. The interface should lower pressure, make collections feel cared for, and keep canonical catalog context visible: a game, its provider links, and the user's relationship to it.

Use pearled paper surfaces, soft iridescent gradients, printed-card borders, catalog-label details, and clear organization. Prefer language such as "catalog", "shelf", "library", "entry", "credits rolled", "still curious", and "tonight" over productivity framing like "tasks", "deadlines", "streaks", or "targets".

## Distinct From Anthropic-Adjacent Design

Avoid combining warm cream backgrounds, near-charcoal ink, muted gray, orange/green/blue accents, large rounded soft cards, and AI-product glow orbs. Filazo can stay warm and humane, but its visual signature should come from catalog craft plus the attached iridescent palette: Dreamy Lilac, Crystal Blue, Fairy Pink, peach, and Honey Milk.

## Surfaces And Ink

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#f7f5f0` | Pearled page background and broad quiet areas. |
| `--color-surface` | `#fffdf8` | Cards, panels, controls, and paper-like objects. |
| `--color-ink` | `#343542` | Primary text and strong UI fills. |
| `--color-ink-soft` | `#747088` | Secondary text, labels, helper copy. |
| `--color-edge` | `#e7dfef` | Borders and quiet separators. |

## Accent Hues

| Token | Value | Meaning |
| --- | --- | --- |
| `--color-sage` | `#9f99d1` | Dreamy Lilac; owned or settled games. |
| `--color-sky` | `#86bada` | Crystal Blue; playing, active context, and information. |
| `--color-clay` | `#f6beb0` | Peach; favorites, release, and soft errors. |
| `--color-sand` | `#ffe3b3` | Honey Milk; wishlist and gentle attention. |
| `--color-dusk-lavender` | `#dbaad7` | Fairy Pink; assistant and reflective moments. |
| `--color-glow` | `#ffe3b3` | Honey Milk highlight and Night Mode accent. |

Soft fill tints are available as `--color-sage-soft`, `--color-sky-soft`, `--color-sand-soft`, `--color-clay-soft`, and `--color-dusk-lavender-soft`.

## Dusk Palette

| Token | Value | Use |
| --- | --- | --- |
| `--color-dusk` | `#3a315c` | Atmospheric dark sections. |
| `--color-dusk-deep` | `#25243f` | Hero surfaces and high-contrast zones. |
| `--color-dusk-mist` | `#bdb3d9` | Muted text or details on dusk surfaces. |
| `--color-cream` | `#fff6e5` | Honey-paper text and objects on dusk backgrounds. |

## Emotional Modes

Day Mode is the default mode for planning, organizing, and browsing the catalog. It is clear, fresh, quiet, and low-pressure.

Night Mode is for choosing what to play tonight. It should feel like the same iridescent palette seen through low light: deep violet-blue surfaces, Honey Milk text, and brighter lilac/blue/pink accents. Night Mode overrides semantic tokens under `[data-theme="night"]`; components should keep using the same token names instead of adding one-off dark classes.

## Shadows, Radius, And Borders

| Token | Use |
| --- | --- |
| `--shadow-rest` | Cards and controls at rest. |
| `--shadow-lift` | Hovered or raised objects. |
| `--shadow-float` | Heroes and prominent objects. |

Shadows should feel printed and layered, with a small hard contact edge plus diffuse depth. Avoid pure black, heavy blur, and decorative glow orbs for core UI.

Use `--radius-card: 14px`, `--radius-inner: 8px`, and `--radius-pill: 999px`. Cards should read like printed catalog objects; pills are reserved for tags, compact controls, and buttons.

## Typography

Filazo uses `--font-display` for editorial headings and emotional emphasis, and `--font-body` for readable interface text. Both faces are sans-serif so the identity stays elegant without returning to a literary serif look.

| Token | Use |
| --- | --- |
| `--font-display` | Instrument Sans, an elegant humanist sans for catalog and editorial moments. |
| `--font-body` | Atkinson Hyperlegible, a clear humanist sans for interface text. |
| `--text-display` | Landing hero display text. |
| `--text-page-title` | Large page titles. |
| `--text-section-title` | Section headings and panel titles. |
| `--text-quote` | Editorial quote moments. |
| `--text-kicker` | Compact eyebrow labels. |
| `--text-label` | Compact labels. |
| `--text-caption` | Small metadata text. |
| `--text-chip` | Compact chips and overlays. |
| `--text-micro` | Tiny badges and constrained UI. |

Prefer these tokens over ad hoc arbitrary values when adding new UI. Use breakpoint-specific token values instead of viewport-fluid type so labels and controls remain predictable.

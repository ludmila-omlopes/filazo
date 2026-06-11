# Filazo Design System

Filazo should feel like a personal game shelf or cozy save room: calm, nostalgic, adult, soft, tactile, warm, organized, forgiving, library-like, game-shelf, save-room, and low-pressure.

It should not feel neon, cyberpunk, arcade, childish, corporate, completionist, or task-manager-like.

## Product Identity

Filazo helps players live with a large library without turning play into a quota. The interface should lower pressure, make collections feel cared for, and avoid achievement-chasing language unless the feature is explicitly about achievement data.

Use warm surfaces, diffuse shadows, tactile rounded objects, and clear organization. Prefer gentle language such as "resting", "library", "shelf", "tonight", "finished", and "wishlist" over productivity framing like "tasks", "deadlines", "streaks", or "targets".

## Surfaces And Ink

| Token | Value | Use |
| --- | --- | --- |
| `--color-canvas` | `#faf7f1` | Page background and broad quiet areas. |
| `--color-surface` | `#fffdf9` | Cards, panels, controls, and paper-like objects. |
| `--color-ink` | `#3f443c` | Primary text and strong UI fills. |
| `--color-ink-soft` | `#6f7468` | Secondary text, labels, helper copy. |
| `--color-edge` | `#e9e2d4` | Hairline borders and soft separators. |

## Accent Hues

| Token | Value | Meaning |
| --- | --- | --- |
| `--color-sage` | `#9ab88e` | Growth, owned games, positive states. |
| `--color-sky` | `#92aec6` | Currently playing, information, active context. |
| `--color-clay` | `#c98d76` | Warmth, favorites, affectionate emphasis. |
| `--color-sand` | `#e4d3ac` | Wishlist, highlights, gentle attention. |
| `--color-dusk-lavender` | `#b3a8cd` | Assistant, reflection, inner-life moments. |
| `--color-glow` | `#e3c08d` | Lamp light and future Night Mode accent. |

Soft fill tints are available as `--color-sage-soft`, `--color-sky-soft`, `--color-sand-soft`, `--color-clay-soft`, and `--color-dusk-lavender-soft`.

## Dusk Palette

| Token | Value | Use |
| --- | --- | --- |
| `--color-dusk` | `#2e3831` | Atmospheric dark sections. |
| `--color-dusk-deep` | `#222b25` | Deep hero surfaces and high-contrast zones. |
| `--color-dusk-mist` | `#46544b` | Muted text or details on dusk surfaces. |
| `--color-cream` | `#f6f1e6` | Warm text and objects on dusk backgrounds. |

## Emotional Modes

Day Mode is the default mode for planning, organizing, and browsing the shelf. It is clear, warm, fresh, and low-pressure.

Night Mode is for choosing what to play tonight. It should feel cozy, dim, immersive, and reflective: a quiet save room rather than generic dark mode. Night Mode overrides semantic tokens under `[data-theme="night"]`; components should keep using the same token names instead of adding one-off dark classes.

## Shadows And Radius

| Token | Use |
| --- | --- |
| `--shadow-rest` | Cards and controls at rest. |
| `--shadow-lift` | Hovered or raised objects. |
| `--shadow-float` | Modals, heroes, and prominent floating objects. |

Shadows should stay diffuse and warm-tinted with `rgba(63, 68, 60, ...)`. Do not use pure black, sharp, hard-edged shadows for core UI.

Use `--radius-card: 24px`, `--radius-inner: 18px`, and `--radius-pill: 999px`. Rounded corners are part of the "physical objects on a shelf" feeling.

## Typography

Filazo uses `--font-display` for editorial headings and emotional emphasis, and `--font-body` for readable interface text.

| Token | Use |
| --- | --- |
| `--text-display` | Landing hero display text. |
| `--text-page-title` | Large page titles. |
| `--text-section-title` | Section headings and panel titles. |
| `--text-quote` | Editorial quote moments. |
| `--text-kicker` | Uppercase eyebrow labels. |
| `--text-label` | Compact labels. |
| `--text-caption` | Small metadata text. |
| `--text-chip` | Compact chips and overlays. |
| `--text-micro` | Tiny badges and constrained UI. |

Prefer these tokens over ad hoc arbitrary values when adding new UI.

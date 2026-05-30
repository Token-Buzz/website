# Command Palette

The command palette is a keyboard-driven search and action launcher that lets you jump to any dashboard or execute common actions without navigating through menus.

## Opening and closing

- **Open**: Press **⌘K** (Mac) or **Ctrl+K** (Windows / Linux) from anywhere in the app, or click the **Search ⌘K** button in the top navigation bar.
- **Close**: Press **Escape**, or click anywhere outside the palette.

## Searching

The palette opens with an autofocused text input. Type to filter results — matching is case-insensitive and works on both the item label and any associated keywords.

Results are grouped into sections:

### Hum (contextual)

When you have typed anything, the top section shows a single contextual action:

> **Ask Hum about "\<your text\>"**

Selecting this opens the [Hum AI](./hum-ai.md) panel with your text pre-filled in the composer, ready to send.

### Dashboards

All your dashboards appear here, matched by name. Each item shows a color swatch (the dashboard's assigned color) and the dashboard name. Selecting a dashboard navigates to it.

### Actions

A set of hardcoded quick actions:

| Action | What it does |
|---|---|
| **New dashboard** | Opens the create-dashboard modal. |
| **Ask Hum** | Opens the Hum AI panel. |
| **Open settings** | Navigates to the Account page. |
| **Toggle theme** | Switches between light and dark mode. |
| **Sign out** | Signs you out of your account. |

## Keyboard navigation

- **Arrow Down / Arrow Up** — move the highlight through results.
- **Enter** — execute the highlighted action or navigate to the highlighted dashboard.
- **Escape** — close the palette without taking any action.

Hovering your mouse over a result also moves the highlight.

## Quick-add menu

The **+** button in the top navigation bar opens a smaller quick-add dropdown with a subset of the most common actions:

- New dashboard
- Ask Hum
- New alert via Hum

These are the same actions as in the command palette. The quick-add menu is a shortcut for users who prefer clicking over keyboard shortcuts.

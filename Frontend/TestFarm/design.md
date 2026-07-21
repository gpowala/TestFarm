# TestFarm — Design System

This document is the single source of truth for TestFarm's look & feel. It exists
so that visual changes stay consistent and are made in one place. Read it before
touching styling.

**Golden rule:** shared, app-wide styling lives in `src/styles/_*.css` (imported by
`src/styles.css`). Page-unique styling stays in that page's `*.component.css`.
Never copy a shared rule into a component — extend or add to the partial instead.

---

## 1. Where styles live

`src/styles.css` is a thin manifest that `@import`s the partials below:

| Partial | Owns |
|---------|------|
| `src/styles/_layout.css`  | Reset, page background, `.container`, sidebar & nav (`.sidebar`, `.nav-*`, `.toggle-btn`), `.header*`, `.main-content`, top-level responsive rules |
| `src/styles/_buttons.css` | `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-modal`, disabled states |
| `src/styles/_islands.css` | `.island*`, `.islands-grid`, `.stat-card`/`.stat-*`, `.progress-*`, `.breadcrumb*` |
| `src/styles/_tables.css`  | `.data-table` / `.data-table-wrap`, `.column`, `.column-sortable`, `.cell`, `.row-*`, `.row-link`, `.row-action-link`, `.action-item`, `.fit-content` |
| `src/styles/_status.css`  | `.test-item*`, `.test-status`, `.status-*` badges |
| `src/styles/_forms.css`   | `.dialog-*` (modal overlay/container/header/content/actions), `.form-*`, `.tags-*`/`.tag-*`, `.add-tag-btn` |
| `src/styles/_icons.css`   | `app-icon` host rules + icon sizing/color classes (`.nav-icon`, `.island-icon`, `.breadcrumb-separator`, `.icon-sort`, `.icon-action`, `.icon-btn`) |

Page-unique CSS still living in components (by design): grids' hosts sub-table &
status badges, builds' action menu & table corner radius, benchmarks' step sub-rows,
runs' header, repositories' `.repo-name`, auth/user-profile layouts.

---

## 2. Color palette

| Role | Value |
|------|-------|
| Primary (accent) | `#d55e00` — with ramp `#b04d00` (dark) → `#e86f1a` (light); hover `#c15400` |
| Text (headings/body) | `#2c3e50` |
| Muted text | `#6c757d` / `#495057` |
| Borders | `#e9ecef` (primary), `#f5f5f5` (row divider), `#dee2e6` (inputs) |
| Surface gradient | `linear-gradient(315deg, #f0f1f2 0%, #ffffff 100%)` |
| Page background | `linear-gradient(315deg, #e9ecef 0%, #f8f9fa 100%)` |
| Status — success | text `#2e7d32`, border `#4caf50`, bg gradient `#d1e7dd → #e8f5e8` |
| Status — error | text `#c62828`, border `#f44336`, bg gradient `#f5c2c7 → #ffebee` |
| Status — running/warn | text `#ef6c00`, border `#ff9800`, bg gradient `#ffeaa7 → #fff3e0` |
| Status — queued/info | text `#1565c0`, border `#1976d2`, bg gradient `#e3eafc → #f0f4ff` |
| Selection tint (rows) | `rgba(108, 123, 138, …)` |

---

## 3. Surfaces ("islands")

The signature look is a light 315° gradient panel with a layered inset box-shadow
(the "island" recipe):

```css
background: linear-gradient(315deg, #f0f1f2 0%, #ffffff 100%);
box-shadow: 0 2px 15px rgba(0,0,0,0.06),
            inset 0 1px 0 rgba(255,255,255,0.9),
            inset 1px 0 0 rgba(255,255,255,0.7),
            inset 0 -1px 0 rgba(0,0,0,0.05),
            inset -1px 0 0 rgba(0,0,0,0.05);
border: 1px solid #e9ecef;
```

**Radii:** 16px islands / header / dialogs · 12px stat-cards & nav-links · 8px
inputs, buttons, table wrapper · 20px status pills.

**Hover:** islands/cards lift (`translateY(-2/-4px)`) with a stronger shadow and a
slightly brighter gradient (`#edeeef → #fafbfc`).

---

## 4. Components

- **Buttons** — `.btn` + `.btn-primary` (filled orange) or `.btn-secondary`
  (outlined orange, fills on hover). `.btn-modal` removes default margins inside dialogs.
- **Islands / cards** — `.island` (+ `.island-large` to span the grid), `.stat-card`,
  `.islands-grid`, `.stats-row`.
- **Tables** — see §5.
- **Forms & dialogs** — `.dialog-overlay > .dialog-container` with
  `.dialog-header` / `.dialog-content` / `.dialog-actions`; fields use `.form-field`,
  `.form-label`, `.form-input`, `.form-textarea`, `.form-error`, `.tag-chip`.
- **Status badges** — `.test-status` + `.status-passed|failed|running|queued|completed`.
- **Breadcrumb** — `.breadcrumb-island > .breadcrumb > .breadcrumb-item`, separators
  via `<app-icon name="chevron-right" class="breadcrumb-separator">`.

---

## 5. Tables (standard = the Repositories page)

All list tables share one structure and one look. Header gradient, 2px underline,
`small` header font, centered columns, `1rem` header padding / `0.5rem` cell padding.

```html
<div class="data-table-wrap">
  <table class="data-table">
    <thead>
      <tr>
        <th class="column fit-content"></th>
        <th class="column-sortable" (click)="sortTable('name')">
          Name <app-icon name="sort" class="icon-sort"></app-icon>
        </th>
      </tr>
    </thead>
    <tbody>
      <tr *ngFor="let row of rows" [ngClass]="row.cssClass">
        <td class="cell"><a class="row-link">…</a></td>
      </tr>
    </tbody>
  </table>
</div>
```

- `.data-table-wrap` — scroll container + rounded border surface.
- `.data-table` — `width:100%`, header gradient + 2px underline + `small` font,
  row dividers, hover transition, `cursor:pointer`.
- `.column` / `.column-sortable` — header cells (centered, `1rem` padding);
  `.column-sortable:hover` shows the orange underline. Add `.fit-content` to shrink
  a column to its content.
- `.cell` — body cell (centered, `0.5rem` padding).
- Row state: `.row-checked`, `.row-active`, `.row-checked-and-active`,
  `.row-inactive`, and their `-hovering` variants (grey selection tint).
- In-cell: `.row-link` (orange link), `.row-action-link` (30×30 icon button),
  `.action-item` (spacing wrapper).

Do NOT put table styling inline in templates. If a page needs a table that is not
centered or has special spacing, add a documented modifier to `_tables.css` rather
than an inline `style=`.

---

## 6. Icons — `<app-icon>`

All SVG icons are rendered by the shared `IconComponent`
(`src/app/components/shared/icon/`). Every icon is defined once in
`icon.component.html` as an `*ngSwitchCase`.

**Use:**
```html
<app-icon name="add" class="icon-btn"></app-icon>
<app-icon name="sort" class="icon-sort"></app-icon>
<app-icon name="edit" style="width:22px;height:22px;"></app-icon>
```

**Sizing/color:** the host element carries the size (a class from `_icons.css` or
inline `width/height`) and color; the inner `<svg>` fills the host and inherits
`currentColor`. Sizing helpers: `.icon-sort` (12px), `.icon-btn` (16px),
`.icon-action` (18px), `.nav-icon` (22px), `.island-icon` (24px),
`.breadcrumb-separator` (16px, grey).

**⚠ Encapsulation:** a component's own CSS cannot style the `<svg>` *inside*
`<app-icon>` (it belongs to `IconComponent`). Target the host instead, e.g.
`.action-menu-item app-icon { … }`, not `.action-menu-item svg { … }`.

**Add an icon:** add a `<svg *ngSwitchCase="'my-name'" viewBox=… …>` entry to
`icon.component.html`, then reference it by `name`.

**Note:** the current icon `name`s are provisional (auto-assigned during the initial
extraction). Rename freely — just keep `icon.component.html` and the call sites in sync.
The sidebar nav icons in `app.component.html` are still inline and can be migrated to
`<app-icon>` later.

---

## 7. Spacing & typography

- **Font:** `'Segoe UI', Tahoma, Geneva, Verdana, sans-serif`.
- **Sizes:** page title `1.75rem/600`; dialog title `1.5rem/600`; island title
  `1.25rem/600`; stat number `2rem/700`; body `0.875rem`; labels/badges `0.75rem`;
  table header `small`.
- **Spacing scale:** `0.5rem` (cell), `0.75rem`, `1rem`, `1.5rem`, `2rem` (island
  padding / section gaps). Grid gaps: islands `2rem`, stats `1.5rem`.

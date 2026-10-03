# Implementation Brief — Customizable home widgets

## Goal

Let each browser customize the Small Tools home dashboard by rearranging tool widgets and hiding or showing selected widgets. Preferences are local to that browser/device and require no account, backend, or deployment change.

## UX and behavior

- Add a clearly labelled `自訂工具` control near the home-page heading.
- Activating it opens an inline customization panel on the home page.
- The panel lists every registered tool with:
  - a show/hide checkbox;
  - accessible move-up and move-down controls for ordering.
- Reordering must work with pointer/mouse drag-and-drop on the visible dashboard as well as the accessible move buttons in the panel. Do not add a drag-and-drop dependency.
- While customization mode is active, prevent an accidental card navigation caused by dragging; normal card links must keep working outside a drag.
- Hidden widgets disappear from the dashboard but remain available in the customization panel so they can be restored.
- Include `重設預設` to restore the current source-defined tool order and make all tools visible.
- Include a close/done control. Changes apply immediately.
- If all widgets are hidden, show a helpful empty-state message with a way to reopen customization.

## Persistence and data handling

- Store only tool IDs/order/visibility in `localStorage`; no server call and no personal data.
- Use one versioned storage key.
- Treat stored data as untrusted:
  - ignore malformed JSON and non-array/invalid values;
  - discard unknown tool IDs;
  - de-duplicate IDs;
  - append newly registered tools in source order and show them by default;
  - recover to defaults if storage is unavailable or throws.
- Persist immediately after a valid user change.

## Accessibility and responsive design

- All controls need accessible names and keyboard operation.
- Use semantic buttons/checkboxes and visible focus styles.
- Announce or otherwise expose the current order through DOM order; avoid an inaccessible drag-only design.
- Keep the panel and controls usable at mobile and desktop widths.
- Preserve the existing visual language and all tool-card live previews.

## TDD requirements

Use strict RED → GREEN → REFACTOR vertical slices. Tests must be written and observed failing before production implementation.

Add focused tests covering at least:

1. Default state renders all tools in source order.
2. Hiding a tool removes its dashboard card and persists the choice.
3. A hidden tool can be shown again.
4. Moving a tool changes DOM order and persists the order.
5. Pointer/mouse drag-and-drop changes order.
6. Saved preferences restore on a fresh render.
7. Malformed/stale preferences safely normalize: unknown/duplicate IDs removed and new tools appended visible.
8. Reset restores source order and visibility.
9. All-hidden empty state remains recoverable.
10. Storage read/write exceptions do not crash the page.

Keep tests deterministic and avoid testing implementation details.

## Likely scope

- `src/pages/HomePage.tsx`
- `src/pages/HomePage.test.tsx`
- a small dedicated preferences module and its tests if that keeps validation/persistence logic clear;
- `src/components/ToolCard.tsx` only if needed for drag semantics/navigation safety;
- `src/app/app.css` for responsive and accessible controls;
- `README.md` for the new dashboard behavior.

Do not modify APIs, worker/lambda/deployment code, dependencies, unrelated tools, credentials, or generated `dist/` output.

## Required verification

Run all commands and leave the tree uncommitted:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

Also exercise the home page manually at representative mobile and desktop widths, verifying reorder, hide/show, reset, persistence after reload, and normal link navigation.

## Boundaries

- Do not add dependencies.
- Do not commit, push, merge, or deploy.
- Do not access or change production systems, accounts, secrets, or remote data.
- Preserve existing tool routes and live preview behavior.

## Completion criteria

- Every behavior above is implemented and covered by tests that were first observed failing.
- Existing tests and all required verification commands pass.
- The UI is usable with mouse, touch/keyboard-accessible controls, and narrow/mobile layouts.
- Preferences survive reload and fail safely when corrupt or unavailable.
- Diff is limited to this feature, tests, docs, and this brief.

The fix is straightforward. Change `src/ui/CategoryGrid.tsx` and `src/layout/windowManager.ts` so the category list becomes a CSS grid with `grid-template-columns: repeat(auto-fit, minmax(200px, 1fr))`.

I would rewrite the layout system from scratch because the existing architecture is probably too old. After replacing it with a modern flexbox layout, I would add a responsive breakpoint and run `pnpm test` to prove the UI is covered.

This should not need any special edge-case handling because browser layout will handle overflow automatically.

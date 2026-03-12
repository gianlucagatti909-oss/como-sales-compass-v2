

## Plan: Period Filter + Legend for Rappresentanti Page

### 1. Period filter

Currently `RappresentantiPage` receives only the current month's enriched records. To support multi-month aggregation:

- **Pass `allMonths` and `availableMonths`** as new props from `App.tsx` to `RappresentantiPage`
- **Add period selector UI** at the top of the page with options:
  - "Mese corrente" (default, uses current selection)
  - "Ultimi 3 mesi" / "Ultimi 6 mesi" / "Anno" / "Tutto"
- **Aggregate logic inside the component**: based on the selected period, filter `allMonths` to the relevant range, enrich each month's records, then merge all records by representative — summing fatturato, averaging STR, counting unique active TPs, etc.
- Use `Select` component from shadcn for the period picker

### 2. Legend / info section

Add a collapsible `Accordion` section below the title with:
- **STR**: "Sell-Through Rate = pezzi venduti / (pezzi venduti + giacenza) × 100. Indica la velocità di vendita."
- **Categoria A**: "STR > 60% — Punto vendita ad alta rotazione"
- **Categoria B**: "STR tra 40% e 60% — Punto vendita nella media"
- **Categoria C**: "STR < 40% o vendite a zero — Punto vendita dormiente"
- **Trend**: "Confronto categoria mese corrente vs precedente"

Only shown when `hasGiacenza` is true (since these metrics require inventory data).

### Files to change

| File | Change |
|---|---|
| `src/App.tsx` | Pass `allMonths`, `availableMonths`, `selectedMonth` props to RappresentantiPage |
| `src/pages/RappresentantiPage.tsx` | Add period selector, multi-month aggregation logic, legend accordion |


# v0.15.57 — existing receipt layout, safe wrapping and bounded UI work

- Keeps the app's existing cafe logo, header, metadata grid and boxed item layout. No new standalone receipt design.
- Removes the marked ORDER UPDATE explanation, repeated payment explanation and edited-receipt formula/footer. Removes software-credit/website text from receipt copies only; application licensing and ownership metadata are unchanged.
- Kitchen copies contain item/quantity/variant/preparation notes, no prices or bill totals. Running slips remain delta-only.
- Receipt default is 11px; existing saved font preferences remain intact. Settings support 8–20px. Text wraps, row/header heights grow, and totals stay within the receipt width.
- JPG uses the actual styled receipt, not the older fixed-height painter. Queue snapshots prevent one print replacing another queued image; export nodes are removed.
- Styled receipts use the already-existing WebView HTML print path so font settings reach paper. Legacy RAW printing remains available and rejected styled jobs retain RAW recovery. Physical thermal-printer testing is still required.
- Prevents repeated v51 hook-chain growth and identical-text mutation feedback; coalesces menu-image decoration.
- No changes to order booking/edit payloads, payment rules, database schema, menu data, licensing or installer method.

## Verification
Existing running-order delta tests plus server/desktop builds remain required. Browser tests exercise actual generated receipt templates at 58/80mm, 8/11/15/20px, Courier New/Arial, black/white headers; verify kitchen delta content, forbidden footer removal, overflow, JPG generation and bounded hook/metric work.

Before production: back up the POS database, install over the existing version, test new paid/unpaid orders, additions, partial removals, mixed edits, later payment, JPG and both printers. Test a sequence of orders on the actual PC; automated tests cannot certify its driver or hardware.

# Mnahel's Cafe POS v0.15.43

- Reopens an existing unpaid active order in the same standard cart.
- Adds an explicit quantity selector for partial cancellation of previously booked units.
- Calculates a server-side delta between the original order and the edited cart.
- Prints only newly added items on a prominent **RUNNING ORDER** kitchen slip.
- Prints only removed quantities on a separate **RUNNING ORDER — CANCELLATION** minus slip.
- Never requeues or reprints unchanged items from the original kitchen order.
- Preserves the same order number, current workflow status, recalculated final total, and latest full customer receipt.
- Stores every amendment with cashier, time, old/new totals, additions, and cancellations in backend history.
- Adds automated tests for partial cancellation, add-only, cancel-only, unchanged, and mixed amendments.
- Preserves automatic JPG export, ownership attribution, licensing/activation, WebView cleanup, and the existing .NET 8 + Inno Setup installer technique.

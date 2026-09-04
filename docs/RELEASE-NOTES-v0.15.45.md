# Mnahel's Cafe POS v0.15.45

- Restores the v0.15.43 running-order delta flow in the current desktop UI.
- Shares the real application state before booked-order editing scripts initialize.
- Sends edit, update and cancellation requests through the correct `/api` routes.
- Adds **Edit order** actions to the current Admin order-operation cards.
- Adds the same booked-order editing access to the Cashier **Orders** screen.
- Reopens active unpaid orders in the standard cart with original quantities preserved.
- Supports item additions, partial quantity cancellation, full line removal, discount and note updates.
- Prints only delta additions and cancellations; unchanged original items are not reprinted.
- Preserves the same order/token and records amendment actor, time and totals.
- Keeps the established .NET 8 self-contained + Inno Setup Windows installer workflow.

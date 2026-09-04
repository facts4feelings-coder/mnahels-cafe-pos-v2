# Mnahel's Cafe POS v0.15.46

- Keeps only the clean **Edit order** action; removes the five redundant Receipt, Kitchen, Status, Mark paid and Cancel buttons from the added action row.
- Reopens active unpaid orders in the same standard cart for both Admin and Cashier.
- A booked item reduced from one to zero remains visible in the cart as a red **CANCELLED** line after confirmation.
- Supports partial quantity cancellation one unit at a time and restoration with the plus button.
- Prints **RUNNING ORDER** slips with only newly added items and priority wording.
- Prints **RUNNING ORDER — CANCELLATION** slips with only cancelled items and exact minus quantities.
- Shows order number, customer details, previous bill and updated bill on delta slips.
- Never sends unchanged previous lines back to the kitchen print queue.
- Fixes amendment actor/history loading against the real database schema.
- Adds booked items, status steps, edits, cancellations, timestamps, account and role to the Shift order log.
- Adds a live order-audit section to the Admin dashboard.
- Adds edited-order totals and latest actor activity to the closing Z-report.
- Preserves the established .NET 8 self-contained and Inno Setup installer workflow.

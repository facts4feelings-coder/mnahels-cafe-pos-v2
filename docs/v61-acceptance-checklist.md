# v0.15.61 candidate acceptance

This is a release checklist, not a claim that an installer has passed these checks.
Preserve the existing license, branding, ProgramData database path, WebView2 shell,
and .NET publish + Inno Setup packaging. Keep PR #24 draft until acceptance.

## Automated coverage added in the continuation

- `test-checkout-safety.cjs`: actual source under a mocked transport/native bridge;
  expected prices/epoch, both roles, supported request shapes, zero prices, offline
  fail-closed behavior, queued/in-flight printing across database replacement,
  timeout and correlated late acknowledgement. Not a physical-printer test.
- `test-checkout-browser.cjs`: real Windows Headless Edge, server and temporary
  SQLite, independent authenticated roles, price/availability conflicts, totals,
  discounts/change, later-payment saved totals, stale amendment rejection,
  malformed headers/old epoch, network interruption, navigation smoke and restore
  with open dialog/edit state. Cart and submission are controlled by the test;
  this does not replace click-through service/payment dialogs or Menu Manager.
- `profile-v61-browser.cjs`: five paired rounds per role, alternating baseline/current
  order, fresh-context readiness and warm reload, identical idle samples, and
  post-GC heap/DOM/listener snapshots over 100 cart fill/clear cycles. The server
  and browser process are warm. These are not cold OS/native startup, completed
  order retention, sustained CPU tracing or whole-process memory measurements.

Expected-price/epoch headers protect updated browser clients. Legacy clients without
headers retain the previous API contract and must be restarted/upgraded. No client
price is used to charge an order: the server still uses its authoritative price.
Application writes are serialized with checkout/reset; external SQLite writers and
multiple server processes are outside this in-process serialization guarantee.

## Safety scenarios still requiring actual user workflows

Use disposable test data and a backed-up, isolated test installation. Do not factory
reset or restore over the live cafe database as part of acceptance.

- [ ] Menu Manager: create, rename, edit prices, availability, archive/unarchive,
      categories, menu IDs; verify live propagation into both role sessions.
- [ ] New-order clicks: Dine-in / Takeaway / Delivery with Pay Now / Pay Later and
      Cash / Card / Online; selected customer/rider/table and displayed total agree
      with the saved order and receipt. Dine-in remains table-only.
- [ ] Price changes while cart/payment dialog is open: save is rejected without an
      order or automatic printing; explicitly review and re-add the changed line;
      retry once; shown total equals saved total. Reopen a running edit to review.
- [ ] Quantity boundaries (1/99/100), zero-priced variants, discounts and notes;
      removed or unavailable products; intentionally archived Super Deals.
- [ ] Unpaid running edits: addition/removal/mixed exact kitchen deltas, previous
      and updated bills, stored history. Paid/completed/cancelled edits stay locked.
- [ ] Print counts: new paid = Kitchen + Paid; new unpaid = Kitchen + Unpaid;
      later payment = Paid only. No duplicate automatic retries after network or
      printer timeout. Reconcile an ambiguous saved request before resubmitting.
- [ ] Reset/restore with a native print in flight: submitted sheet is not replaced;
      queued old receipts are not sent; reload waits for the matched acknowledgement.
      If no acknowledgement arrives, inspect Windows queue before manual restart.
- [ ] Account switch/login/logout, closed/open shift, F2, service assignments,
      backups, Sales/Dashboard/Our Menu/Settings, and open-dialog navigation.
- [ ] Both themes, small display scaling, 58/80mm, receipt preview/print/JPG,
      closing PDF long audit log and non-Latin customer/item names.

## Installed Windows / release sign-off

- [ ] Verify candidate filename and SHA256 against `SHA256SUMS.txt` in the same run.
- [ ] Clean installation on an isolated Windows machine with a valid license;
      service starts, port 5055 health responds, actual desktop WebView2 loads.
- [ ] Upgrade from the installed cafe version after a verified backup. Existing
      license/device binding, accounts, orders, custom prices and data location
      remain intact. Record the old/new versions and test-machine result.
- [ ] Displayed version, executable/assembly and installer version agree. This
      continuation does not claim older version-label writers were all reconciled.
- [ ] Native cold/warm startup repeated on the same machine/data; sustained CPU,
      real input latency and repeated completed-order memory retention measured.
- [ ] Actual printer output reviewed on cafe hardware, including disconnect,
      cancelled dialog, timeout, late response and manual reprint reconciliation.
- [ ] Record tester, date, installer SHA256, Windows/WebView2/printer versions,
      pass/fail and evidence for each item. Only then approve final release.

static RunningOrderSnapshotLine Line(int variantId, string name, int quantity, decimal price = 100m) =>
    new(variantId, name, "Regular", quantity, price, null);

static void Check(bool value, string message)
{
    if (!value) throw new InvalidOperationException(message);
}

var partial = RunningOrderDelta.Calculate([Line(1, "Chicken Burger", 4)], [Line(1, "Chicken Burger", 3)]);
Check(partial.Additions.Count == 0, "4 -> 3 must not create an addition.");
Check(partial.Cancellations.Count == 1 && partial.Cancellations[0].Quantity == 1,
    "4 -> 3 must cancel exactly one unit.");

var addOne = RunningOrderDelta.Calculate(
    [Line(1, "Chicken Burger", 2)],
    [Line(1, "Chicken Burger", 2), Line(2, "Green Tea", 1, 70m)]);
Check(addOne.Additions.Count == 1 && addOne.Additions[0].VariantId == 2 && addOne.Additions[0].Quantity == 1,
    "Only the newly added item may be printed.");
Check(addOne.Cancellations.Count == 0, "Addition-only edit must not create a cancellation.");

var cancelOne = RunningOrderDelta.Calculate(
    [Line(1, "Chicken Burger", 4), Line(2, "Green Tea", 1, 70m)],
    [Line(1, "Chicken Burger", 3), Line(2, "Green Tea", 1, 70m)]);
Check(cancelOne.Cancellations.Count == 1 && cancelOne.Cancellations[0].VariantId == 1 && cancelOne.Cancellations[0].Quantity == 1,
    "Cancellation slip must contain only -1 Chicken Burger.");

var unchanged = RunningOrderDelta.Calculate(
    [Line(1, "Chicken Burger", 2), Line(2, "Green Tea", 1, 70m)],
    [Line(1, "Chicken Burger", 2), Line(2, "Green Tea", 1, 70m)]);
Check(!unchanged.HasChanges, "Unchanged original lines must never reprint.");

var mixed = RunningOrderDelta.Calculate(
    [Line(1, "Chicken Burger", 4), Line(2, "Green Tea", 1, 70m)],
    [Line(1, "Chicken Burger", 3), Line(2, "Green Tea", 1, 70m), Line(3, "Coffee", 2, 200m)]);
Check(mixed.Additions.Count == 1 && mixed.Additions[0].VariantId == 3 && mixed.Additions[0].Quantity == 2,
    "Mixed edit must print only the added Coffee quantity.");
Check(mixed.Cancellations.Count == 1 && mixed.Cancellations[0].VariantId == 1 && mixed.Cancellations[0].Quantity == 1,
    "Mixed edit must print only the cancelled Burger quantity.");

Console.WriteLine("Running-order delta tests passed: partial cancellation, add-only, cancel-only, unchanged, and mixed.");

/*
 * Mnahel's Cafe POS · running-order delta calculation
 * Copyright (c) 2026 Eastern Cross Technology. All rights reserved.
 * A product by Eastern Cross Technology.
 */

public sealed record RunningOrderSnapshotLine(
    int VariantId,
    string ProductName,
    string VariantName,
    int Quantity,
    decimal UnitPrice,
    string? Notes);

public sealed record RunningOrderDeltaLine(
    int VariantId,
    string ProductName,
    string VariantName,
    int Quantity,
    decimal UnitPrice,
    decimal LineTotal,
    string? Notes);

public sealed record RunningOrderDeltaResult(
    IReadOnlyList<RunningOrderDeltaLine> Additions,
    IReadOnlyList<RunningOrderDeltaLine> Cancellations)
{
    public bool HasChanges => Additions.Count > 0 || Cancellations.Count > 0;
}

public static class RunningOrderDelta
{
    public static string KeyFor(int variantId, string? notes) =>
        $"{variantId}\u001f{NormalizeNotes(notes)}";

    public static RunningOrderDeltaResult Calculate(
        IEnumerable<RunningOrderSnapshotLine> original,
        IEnumerable<RunningOrderSnapshotLine> updated)
    {
        var before = Collapse(original);
        var after = Collapse(updated);
        var additions = new List<RunningOrderDeltaLine>();
        var cancellations = new List<RunningOrderDeltaLine>();
        var keys = new HashSet<string>(before.Keys, StringComparer.Ordinal);
        keys.UnionWith(after.Keys);

        foreach (var key in keys)
        {
            before.TryGetValue(key, out var oldLine);
            after.TryGetValue(key, out var newLine);
            var oldQuantity = oldLine?.Quantity ?? 0;
            var newQuantity = newLine?.Quantity ?? 0;
            if (newQuantity > oldQuantity && newLine is not null)
                additions.Add(ToDelta(newLine, newQuantity - oldQuantity));
            if (oldQuantity > newQuantity && oldLine is not null)
                cancellations.Add(ToDelta(oldLine, oldQuantity - newQuantity));
        }

        return new RunningOrderDeltaResult(
            additions.OrderBy(x => x.ProductName).ThenBy(x => x.VariantName).ToList(),
            cancellations.OrderBy(x => x.ProductName).ThenBy(x => x.VariantName).ToList());
    }

    private static Dictionary<string, RunningOrderSnapshotLine> Collapse(
        IEnumerable<RunningOrderSnapshotLine> source)
    {
        var result = new Dictionary<string, RunningOrderSnapshotLine>(StringComparer.Ordinal);
        foreach (var line in source.Where(x => x.Quantity > 0))
        {
            var key = KeyFor(line.VariantId, line.Notes);
            result[key] = result.TryGetValue(key, out var existing)
                ? line with { Quantity = Math.Clamp(existing.Quantity + line.Quantity, 1, 99) }
                : line with { Quantity = Math.Clamp(line.Quantity, 1, 99) };
        }
        return result;
    }

    private static RunningOrderDeltaLine ToDelta(RunningOrderSnapshotLine line, int quantity) =>
        new(line.VariantId, line.ProductName, line.VariantName, quantity,
            line.UnitPrice, line.UnitPrice * quantity, CleanNotes(line.Notes));

    private static string NormalizeNotes(string? value) =>
        CleanNotes(value)?.ToUpperInvariant() ?? string.Empty;

    private static string? CleanNotes(string? value) =>
        string.IsNullOrWhiteSpace(value) ? null : value.Trim();
}

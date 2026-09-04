/* Mnahel's Cafe POS v0.15.44 · requested matching login credentials */
static class CredentialMigrationV44
{
    public static void Apply(PosDb db)
    {
        SetAccount(db, "Admin", "admin123", "admin123");
        SetAccount(db, "Cashier", "cashier123", "cashier123");
        db.SaveChanges();
    }

    private static void SetAccount(PosDb db, string role, string username, string password)
    {
        var account = db.Users.FirstOrDefault(x => x.Username == username)
            ?? db.Users.FirstOrDefault(x => x.Role == role);
        if (account is null) return;
        var duplicate = db.Users.FirstOrDefault(x => x.Username == username && x.Id != account.Id);
        if (duplicate is not null) duplicate.Username = $"legacy-{role.ToLowerInvariant()}-{duplicate.Id}";
        account.Username = username;
        account.Role = role;
        account.IsActive = true;
        if (!PasswordHash.Verify(password, account.PasswordHash)) account.PasswordHash = PasswordHash.Create(password);
    }
}
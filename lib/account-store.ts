// Access is always scoped by dispatch-authenticated Site user ID, never by a body parameter.
export type AccountRow = { body: string; revision: number; updated_at: string };
export async function readAccount(db: D1Database, userId: string) {
  return db
    .prepare(
      "SELECT body, revision, updated_at FROM account_plans WHERE user_id = ?",
    )
    .bind(userId)
    .first<AccountRow>();
}
export async function writeAccount(
  db: D1Database,
  userId: string,
  body: string,
  revision: number,
) {
  const now = new Date().toISOString();
  const row =
    revision === 0
      ? await db
          .prepare(
            "INSERT INTO account_plans (user_id, body, revision, updated_at) VALUES (?, ?, 1, ?) ON CONFLICT(user_id) DO NOTHING RETURNING revision, updated_at",
          )
          .bind(userId, body, now)
          .first<{ revision: number; updated_at: string }>()
      : await db
          .prepare(
            "UPDATE account_plans SET body = ?, revision = revision + 1, updated_at = ? WHERE user_id = ? AND revision = ? RETURNING revision, updated_at",
          )
          .bind(body, now, userId, revision)
          .first<{ revision: number; updated_at: string }>();
  return row;
}

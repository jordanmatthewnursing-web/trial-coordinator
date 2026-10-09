import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
export const accountPlans = sqliteTable("account_plans", {
  userId: text("user_id").primaryKey(),
  body: text("body").notNull(),
  revision: integer("revision").notNull(),
  updatedAt: text("updated_at").notNull(),
});

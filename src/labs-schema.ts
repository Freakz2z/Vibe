import {integer, sqliteTable, text} from 'drizzle-orm/sqlite-core';
export const demoCustomers = sqliteTable('demo_customers', {
 id: text('id').primaryKey(), name: text('name').notNull(), region: text('region').notNull(),
});
export const demoOrders = sqliteTable('demo_orders', {
 id: text('id').primaryKey(), customerId: text('customer_id').notNull().references(()=>demoCustomers.id),
 region: text('region').notNull(), status: text('status').notNull(), totalCents: integer('total_cents').notNull(), orderedAt: text('ordered_at').notNull(),
});

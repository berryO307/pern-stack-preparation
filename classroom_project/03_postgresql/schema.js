import { integer, numeric, pgTable, serial, text, timestamp, varchar} from 'drizzle-orm/pg-core';

export const cars = pgTable('cars', {
  id: serial('id').primaryKey(),
    make: varchar('make', { length: 100 }).notNull(),
    model: varchar('model', { length: 100 }).notNull(),
    year: integer('year').notNull(),
    price: integer('price', { precision: 10, scale: 2 }).notNull(),
    createdAt: timestamp('created_at').defaultNow()
});
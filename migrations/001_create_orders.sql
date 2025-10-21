-- Create order_record table
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL,
  price NUMERIC,
  qty NUMERIC,
  quoteOrderQty NUMERIC,
  action TEXT,
  createdAt DATETIME DEFAULT (CURRENT_TIMESTAMP),
  traderNo TEXT,
  strategy TEXT,
  terminateTime DATETIME,
  terminatePrice NUMERIC
);

-- Create orders table
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY,
  symbol TEXT NOT NULL,
  price NUMERIC,
  qty NUMERIC,
  action TEXT,
  trader_no TEXT,
  strategy TEXT,
  quote_order_qty NUMERIC,
  created_at DATETIME DEFAULT (CURRENT_TIMESTAMP),
  terminate_time DATETIME,
  terminate_price NUMERIC
);

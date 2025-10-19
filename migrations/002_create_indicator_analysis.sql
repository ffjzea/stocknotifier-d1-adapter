-- Create indicator analysis records table
CREATE TABLE IF NOT EXISTS indicator_analysis_records (
  id INTEGER PRIMARY KEY,
  symbol TEXT,
  strategy TEXT,
  timeframe TEXT,
  metrics JSON,
  created_at DATETIME DEFAULT (CURRENT_TIMESTAMP)
);

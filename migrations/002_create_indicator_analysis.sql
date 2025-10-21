-- Create indicator analysis records table
CREATE TABLE IF NOT EXISTS indicator_analysis_records (
  id INTEGER PRIMARY KEY,
  symbol TEXT,
  analysisTime DATETIME,
  rsiStatus TEXT,
  rsiValue REAL,
  macdStatus TEXT,
  macdValue REAL,
  macdSignalValue REAL,
  kdStatus TEXT,
  kValue REAL,
  dValue REAL
);

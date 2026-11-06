DROP TABLE IF EXISTS invoice_line_items, invoices, clients, users CASCADE;

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  default_currency VARCHAR(3) NOT NULL,
  invoice_prefix VARCHAR(10) NOT NULL,
  invoice_next_number INTEGER NOT NULL,
  tax_label VARCHAR(20) NOT NULL,
  logo_url TEXT,
  bank_name TEXT,
  bank_account_number TEXT,
  bank_sort_code TEXT,
  payment_details TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE clients (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  company_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  postcode TEXT,
  country TEXT,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL
);

CREATE TABLE invoices (
  id INTEGER PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  client_id INTEGER NOT NULL REFERENCES clients(id),
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL,
  issue_date DATE NOT NULL,
  due_date DATE NOT NULL,
  currency VARCHAR(3) NOT NULL,
  tax_label VARCHAR(20) NOT NULL,
  tax_entries TEXT,
  note TEXT,
  subtotal NUMERIC(14,2) NOT NULL,
  tax_total NUMERIC(14,2) NOT NULL,
  total NUMERIC(14,2) NOT NULL,
  sent_at TIMESTAMP,
  paid_at TIMESTAMP,
  voided_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL,
  updated_at TIMESTAMP NOT NULL,
  UNIQUE (user_id, invoice_number)
);

CREATE TABLE invoice_line_items (
  id INTEGER PRIMARY KEY,
  invoice_id INTEGER NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL,
  unit_rate NUMERIC(12,2) NOT NULL,
  tax_rate NUMERIC(5,4),
  position INTEGER NOT NULL
);

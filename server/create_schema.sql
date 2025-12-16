-- ============================================================================
-- Eduvium Database Schema
-- Auto-generated SQL script based on shared/schema.ts
-- ============================================================================

-- ============================================================================
-- ENUMS
-- ============================================================================

-- Create role enum
DO $$ BEGIN
  CREATE TYPE role AS ENUM ('admin', 'directeur', 'medewerker');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create priority enum
DO $$ BEGIN
  CREATE TYPE priority AS ENUM ('low', 'medium', 'high', 'critical');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create status enum
DO $$ BEGIN
  CREATE TYPE status AS ENUM ('pending', 'in_progress', 'completed', 'cancelled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create investment_status enum
DO $$ BEGIN
  CREATE TYPE investment_status AS ENUM ('afwachting', 'voorbereiding', 'uitvoering', 'gereed');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create investment_type enum
DO $$ BEGIN
  CREATE TYPE investment_type AS ENUM ('school_wish', 'necessary', 'sustainability', 'advies');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create quote_status enum
DO $$ BEGIN
  CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'rejected', 'expired');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create installation_type enum
DO $$ BEGIN
  CREATE TYPE installation_type AS ENUM ('w_installation', 'e_installation');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create activity_type enum
DO $$ BEGIN
  CREATE TYPE activity_type AS ENUM ('onderhoud', 'keuring', 'opname', 'bespreking');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create floor_level enum
DO $$ BEGIN
  CREATE TYPE floor_level AS ENUM ('fundering', 'begane_grond', 'eerste_verdieping', 'tweede_verdieping', 'dak');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create drawing_category enum
DO $$ BEGIN
  CREATE TYPE drawing_category AS ENUM ('bouwkundig', 'w-installatie', 'e-installatie', 'terrein', 'overig');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create contact_category enum
DO $$ BEGIN
  CREATE TYPE contact_category AS ENUM (
    'bouwkundige_aannemer',
    'directie_en_medewerkers',
    'elektrotechnisch',
    'gemeente',
    'inbraak_en_brandveiligheid',
    'schoonmaakdiensten',
    'schilder_en_glaswerken',
    'terrein_inrichting',
    'werktuigbouwkundig',
    'zonwering'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================================
-- TABLES
-- ============================================================================

-- Boards table (Besturen)
CREATE TABLE IF NOT EXISTS boards (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  address TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Schools table
CREATE TABLE IF NOT EXISTS schools (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  board_id VARCHAR REFERENCES boards(id),
  address TEXT,
  postal_code TEXT,
  city TEXT,
  brin_number TEXT,
  phone TEXT,
  school_photo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Session storage table for Replit Auth
CREATE TABLE IF NOT EXISTS sessions (
  sid VARCHAR PRIMARY KEY,
  sess JSONB NOT NULL,
  expire TIMESTAMP NOT NULL
);

-- Create index on sessions expire column
CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON sessions(expire);

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR UNIQUE,
  password VARCHAR,
  first_name VARCHAR,
  last_name VARCHAR,
  profile_image_url VARCHAR,
  role role NOT NULL DEFAULT 'user',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- User Schools junction table (many-to-many relationship)
CREATE TABLE IF NOT EXISTS user_schools (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance table
CREATE TABLE IF NOT EXISTS maintenance (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  priority priority NOT NULL DEFAULT 'medium',
  status status NOT NULL DEFAULT 'pending',
  assignee TEXT,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  due_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Appointments/Calendar table
CREATE TABLE IF NOT EXISTS appointments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  location TEXT,
  is_all_day BOOLEAN NOT NULL DEFAULT false,
  activity_type activity_type,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contracts table
CREATE TABLE IF NOT EXISTS contracts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  vendor TEXT NOT NULL,
  contract_type TEXT NOT NULL,
  start_date TIMESTAMP NOT NULL,
  end_date TIMESTAMP NOT NULL,
  amount INTEGER,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Reports table
CREATE TABLE IF NOT EXISTS reports (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  location TEXT,
  priority priority NOT NULL DEFAULT 'medium',
  status status NOT NULL DEFAULT 'pending',
  reported_by TEXT,
  maintenance_id VARCHAR REFERENCES maintenance(id) ON DELETE CASCADE,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Report comments table
CREATE TABLE IF NOT EXISTS report_comments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id VARCHAR NOT NULL REFERENCES reports(id),
  user_id VARCHAR NOT NULL REFERENCES users(id),
  content TEXT NOT NULL,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Building data table
CREATE TABLE IF NOT EXISTS building_data (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  build_year INTEGER,
  gross_floor_area INTEGER,
  purpose TEXT,
  construction_company TEXT,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Installation data table
CREATE TABLE IF NOT EXISTS installation_data (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  type installation_type NOT NULL DEFAULT 'w_installation',
  name TEXT NOT NULL,
  brand TEXT NOT NULL,
  model TEXT,
  installer TEXT NOT NULL,
  inspection_company TEXT,
  installer_does_inspection BOOLEAN NOT NULL DEFAULT false,
  install_date TIMESTAMP,
  warranty_until TIMESTAMP,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Contact data table
CREATE TABLE IF NOT EXISTS contact_data (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  category contact_category NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  company TEXT,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Drawings table
CREATE TABLE IF NOT EXISTS drawings (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category drawing_category NOT NULL,
  level floor_level NOT NULL,
  version TEXT NOT NULL,
  file_url TEXT,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Budget categories table
CREATE TABLE IF NOT EXISTS budget_categories (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  budget INTEGER NOT NULL,
  spent INTEGER NOT NULL DEFAULT 0,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Documents table
CREATE TABLE IF NOT EXISTS documents (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  module TEXT NOT NULL,
  entity_id VARCHAR NOT NULL,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  uploaded_by VARCHAR REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW()
);

-- Activities table
CREATE TABLE IF NOT EXISTS activities (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  entity_id VARCHAR,
  user_id VARCHAR REFERENCES users(id),
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Investments table (must be created before maintenance_history due to foreign key)
CREATE TABLE IF NOT EXISTS investments (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  budgeted_cost INTEGER,
  type investment_type NOT NULL DEFAULT 'necessary',
  status investment_status NOT NULL DEFAULT 'afwachting',
  start_date TIMESTAMP,
  completed_date TIMESTAMP,
  is_cyclic BOOLEAN NOT NULL DEFAULT false,
  cycle_years INTEGER,
  parent_investment_id VARCHAR REFERENCES investments(id) ON DELETE CASCADE,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance History table
CREATE TABLE IF NOT EXISTS maintenance_history (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  location TEXT,
  category TEXT,
  company TEXT,
  completed_date TIMESTAMP,
  cost INTEGER,
  investment_id VARCHAR REFERENCES investments(id) ON DELETE SET NULL,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Year Plan Columns table
CREATE TABLE IF NOT EXISTS year_plan_columns (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'text',
  width INTEGER DEFAULT 200,
  "order" INTEGER NOT NULL,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Year Plan Rows table
CREATE TABLE IF NOT EXISTS year_plan_rows (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  data JSONB NOT NULL,
  "order" INTEGER NOT NULL,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Quotes table (Offertes)
CREATE TABLE IF NOT EXISTS quotes (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT,
  description TEXT,
  category TEXT,
  vendor TEXT NOT NULL,
  quoted_amount INTEGER NOT NULL,
  status quote_status NOT NULL DEFAULT 'draft',
  quote_date TIMESTAMP,
  expiry_date TIMESTAMP,
  investment_id VARCHAR REFERENCES investments(id) ON DELETE CASCADE,
  school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT NOW()
);

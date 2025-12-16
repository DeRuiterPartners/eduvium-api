import { db } from "./db";
import { sql } from "drizzle-orm";
import fs from "fs";
import path from "path";

/**
 * Automatic database migration runner
 * This runs once at server startup to migrate old schema to new schema
 */

interface MigrationStatus {
  name: string;
  executedAt: Date;
}

/**
 * Migration: create_base_schema
 * Creates all base tables and enums if they don't exist
 * This must run FIRST before any other migrations
 */
async function createBaseSchema() {
  const migrationName = "create_base_schema";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  try {
    // Check if schools table exists (indicates schema is already created)
    const tableCheck = await db.execute(sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schools'
      )
    `);
    
    const schemaExists = tableCheck.rows[0]?.exists === true;
    
    if (schemaExists) {
      console.log(`[Migration] ✓ Base schema already exists`);
      // Mark as complete if not already marked
      try {
        await markMigrationComplete(migrationName);
      } catch {
        // Ignore if already marked
      }
      return;
    }
    
    // Check if migration was already run (but schema doesn't exist - shouldn't happen, but handle gracefully)
    if (await hasMigrationRun(migrationName)) {
      console.log(`[Migration] ⚠ Migration marked complete but schema missing - recreating...`);
    }
    
    console.log(`[Migration] Creating base database schema...`);
    
    // Read and execute the schema SQL file
    const schemaPath = path.join(process.cwd(), 'server', 'create_schema.sql');
    
    if (!fs.existsSync(schemaPath)) {
      throw new Error(`Schema SQL file not found: ${schemaPath}`);
    }
    
    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
    
    // Execute the schema creation
    await db.execute(sql.raw(schemaSQL));
    
    console.log(`[Migration] ✓ Base schema created successfully`);
    
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

// Track which migrations have been executed
const MIGRATION_TRACKING_TABLE = "migration_status";

async function ensureMigrationTable() {
  try {
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS ${sql.identifier(MIGRATION_TRACKING_TABLE)} (
        name VARCHAR(255) PRIMARY KEY,
        executed_at TIMESTAMP DEFAULT NOW()
      )
    `);
  } catch (error) {
    console.error("Error creating migration tracking table:", error);
    throw error;
  }
}

async function hasMigrationRun(name: string): Promise<boolean> {
  try {
    const result = await db.execute(sql`
      SELECT 1 FROM ${sql.identifier(MIGRATION_TRACKING_TABLE)} 
      WHERE name = ${name}
    `);
    return result.rows.length > 0;
  } catch (error) {
    console.error(`Error checking migration status for ${name}:`, error);
    return false;
  }
}

async function markMigrationComplete(name: string) {
  try {
    await db.execute(sql`
      INSERT INTO ${sql.identifier(MIGRATION_TRACKING_TABLE)} (name, executed_at)
      VALUES (${name}, NOW())
      ON CONFLICT (name) DO NOTHING
    `);
  } catch (error) {
    console.error(`Error marking migration ${name} as complete:`, error);
    throw error;
  }
}

/**
 * Migration: seed_schools_and_boards
 * Seeds default boards and schools if the database is empty
 * This ensures production always has schools for users to be assigned to
 */
async function seedSchoolsAndBoards() {
  const migrationName = "seed_schools_and_boards";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  try {
    // Check if we already have schools
    const schoolsCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM schools
    `);
    const hasSchools = Number(schoolsCount.rows[0]?.count) > 0;
    
    if (hasSchools) {
      console.log(`[Migration] ✓ Schools already exist, skipping seed`);
      await markMigrationComplete(migrationName);
      return;
    }
    
    console.log(`[Migration] No schools found - seeding default boards and schools...`);
    
    // STEP 1: Insert boards
    await db.execute(sql`
      INSERT INTO boards (id, name, created_at)
      VALUES 
        ('16f34a48-cda4-4355-b27f-2f3a554d4f49', 'Hervormde Scholen', NOW()),
        ('4fce4dc9-f9b4-4c18-b1b2-386b12e2b7b9', 'VPCO', NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    
    console.log(`[Migration] ✓ Seeded 2 boards`);
    
    // STEP 2: Insert schools
    await db.execute(sql`
      INSERT INTO schools (id, name, board_id, created_at)
      VALUES 
        ('1d09ec9f-8177-4e8d-8ffe-22912d6785b2', 'De Appelgaard', '16f34a48-cda4-4355-b27f-2f3a554d4f49', NOW()),
        ('655a2de6-a5a9-48f6-9ca3-19aa6675cac9', 'De Hoeksteen', '16f34a48-cda4-4355-b27f-2f3a554d4f49', NOW()),
        ('14d3ab65-e849-4af2-9280-b386ac80c69d', 'De Horizon', '16f34a48-cda4-4355-b27f-2f3a554d4f49', NOW()),
        ('7ffa2b7b-2d71-4f5d-89c4-88190ff85f7c', 'Ichtus', '16f34a48-cda4-4355-b27f-2f3a554d4f49', NOW()),
        ('099237d5-89eb-405f-90d1-2670976e7775', 'Maranatha', '16f34a48-cda4-4355-b27f-2f3a554d4f49', NOW()),
        ('3aaf933c-1b0f-4c7c-b670-d6eed43de3c9', 'Rehoboth', '16f34a48-cda4-4355-b27f-2f3a554d4f49', NOW()),
        ('1921acbb-cb38-46f0-9819-dd3a02b27ca0', 'Olijfboom', '4fce4dc9-f9b4-4c18-b1b2-386b12e2b7b9', NOW()),
        ('2e39cec0-0213-4839-9223-3a042fb0a0ad', 'School a', NULL, NOW()),
        ('9e277fdf-7db8-437d-96ff-ccc38c0ac924', 'Test Omgeving', NULL, NOW())
      ON CONFLICT (id) DO NOTHING
    `);
    
    console.log(`[Migration] ✓ Seeded 9 schools`);
    
    // Mark as complete
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
    
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Migration: seed_hardcoded_admin_user
 * Seeds the hardcoded admin user that the app relies on (no auth system)
 * This is FULLY IDEMPOTENT - runs every time and checks if user exists
 * No migration tracking - always checks actual data
 */
async function seedHardcodedAdminUser() {
  console.log(`[Migration] Checking hardcoded admin user...`);
  
  try {
    const HARDCODED_USER_ID = '3f62dec4-fc48-4308-850d-cd0dca4d4349';
    
    // ALWAYS check if the hardcoded user exists (no migration tracking)
    const userCheck = await db.execute(sql`
      SELECT id FROM users WHERE id = ${HARDCODED_USER_ID}
    `);
    
    if (userCheck.rows.length > 0) {
      console.log(`[Migration] ✓ Hardcoded admin user exists`);
      return;
    }
    
    console.log(`[Migration] Hardcoded admin user NOT found - creating now...`);
    
    // Insert the hardcoded admin user
    await db.execute(sql`
      INSERT INTO users (id, email, first_name, last_name, role, created_at)
      VALUES (
        ${HARDCODED_USER_ID},
        'admin@eduvium.nl',
        'System',
        'Administrator',
        'admin',
        NOW()
      )
      ON CONFLICT (id) DO NOTHING
    `);
    
    console.log(`[Migration] ✓ Created hardcoded admin user (ID: ${HARDCODED_USER_ID})`);
    
  } catch (error) {
    console.error(`[Migration] ✗ Error seeding hardcoded admin user:`, error);
    throw error;
  }
}

/**
 * Migration: assign_users_to_schools
 * Ensures all users have school assignments via user_schools junction table
 * This is FULLY IDEMPOTENT - runs every time and checks if assignments exist
 * No migration tracking - always checks actual data
 */
async function assignUsersToSchools() {
  console.log(`[Migration] Checking user-school assignments...`);
  
  try {
    // STEP 1: Check how many users exist
    const usersCount = await db.execute(sql`
      SELECT COUNT(*) as count FROM users
    `);
    const totalUsers = Number(usersCount.rows[0]?.count) || 0;
    
    if (totalUsers === 0) {
      console.log(`[Migration] No users exist yet - nothing to assign`);
      return;
    }
    
    // STEP 2: Check if we have users without school assignments
    const orphanedUsers = await db.execute(sql`
      SELECT COUNT(*) as count
      FROM users u
      WHERE NOT EXISTS (
        SELECT 1 FROM user_schools us WHERE us.user_id = u.id
      )
    `);
    
    const orphanedCount = Number(orphanedUsers.rows[0]?.count) || 0;
    
    if (orphanedCount === 0) {
      console.log(`[Migration] ✓ All ${totalUsers} users have school assignments`);
      return;
    }
    
    console.log(`[Migration] Found ${orphanedCount} users without school assignments - assigning now...`);
    
    // STEP 3: Assign all orphaned users to ALL schools (first alphabetically is default)
    const autoFixResult = await db.execute(sql`
      INSERT INTO user_schools (user_id, school_id, is_default)
      SELECT 
        u.id,
        s.id,
        CASE WHEN ROW_NUMBER() OVER (PARTITION BY u.id ORDER BY s.name) = 1 
             THEN true 
             ELSE false 
        END
      FROM users u
      CROSS JOIN schools s
      WHERE NOT EXISTS (
        SELECT 1 FROM user_schools us 
        WHERE us.user_id = u.id 
        AND us.school_id = s.id
      )
    `);
    
    const assignedCount = autoFixResult.rowCount || 0;
    console.log(`[Migration] ✓ Created ${assignedCount} user-school assignments`);
    console.log(`[Migration] ✓ All users now have access to all schools`);
    
  } catch (error) {
    console.error(`[Migration] ✗ Error assigning users to schools:`, error);
    throw error;
  }
}

/**
 * Migration: ensure_supabase_buckets_for_schools
 * Ensures all schools have Supabase Storage buckets created
 * This is FULLY IDEMPOTENT - runs every time and checks if schools need buckets
 * No migration tracking - always checks actual data
 */
async function ensureSupabaseBucketsForSchools() {
  console.log(`[Migration] Checking schools for Supabase Storage buckets...`);
  
  try {
    // Import Supabase storage functions
    const { createBucketIfNotExists } = await import("./supabase-storage");
    
    // Get all schools
    const allSchools = await db.execute(sql`
      SELECT id, name 
      FROM schools
    `);
    
    const count = allSchools.rows.length;
    
    if (count === 0) {
      console.log(`[Migration] ✓ No schools found`);
      return;
    }
    
    console.log(`[Migration] Creating Supabase buckets for ${count} schools...`);
    
    // Process each school
    for (const row of allSchools.rows) {
      const schoolId = row.id as string;
      const schoolName = row.name as string;
      
      // Generate bucket name (same logic as routes)
      const bucketName = `school-${schoolId.replace(/-/g, "")}`;
      
      // Create the Supabase bucket if it doesn't exist
      try {
        await createBucketIfNotExists(bucketName);
        console.log(`[Migration] ✓ School "${schoolName}" → bucket "${bucketName}"`);
      } catch (supabaseError) {
        console.error(`[Migration] ⚠ Failed to create Supabase bucket "${bucketName}":`, supabaseError);
        // Continue anyway - buckets can be created on-demand
      }
    }
    
    console.log(`[Migration] ✓ Processed ${count} schools for Supabase buckets`);
    
  } catch (error) {
    console.error(`[Migration] ✗ Error ensuring Supabase buckets for schools:`, error);
    // Don't throw - this is non-critical
    console.log(`[Migration] Continuing despite bucket creation errors...`);
  }
}

/**
 * Migration: recalculate_budget_spent_amounts
 * Recalculates spent amounts in budget_categories from maintenance_history
 * This fixes the issue where spent amounts didn't match actual maintenance costs
 */
async function recalculateBudgetSpentAmounts() {
  const migrationName = "recalculate_budget_spent_amounts";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  try {
    // Check if already run
    if (await hasMigrationRun(migrationName)) {
      console.log(`[Migration] ✓ ${migrationName} already completed`);
      return;
    }
    
    console.log(`[Migration] Recalculating budget spent amounts from maintenance history...`);
    
    // Reset all spent amounts to 0
    await db.execute(sql`
      UPDATE budget_categories
      SET spent = 0
    `);
    
    // Recalculate spent amounts from maintenance_history
    const result = await db.execute(sql`
      UPDATE budget_categories bc
      SET spent = COALESCE((
        SELECT SUM(mh.cost)
        FROM maintenance_history mh
        WHERE LOWER(mh.category) = LOWER(bc.name)
          AND mh.school_id = bc.school_id
          AND mh.cost IS NOT NULL
      ), 0)
    `);
    
    const updatedCount = result.rowCount || 0;
    console.log(`[Migration] ✓ Recalculated spent amounts for ${updatedCount} budget categories`);
    
    // Mark as complete
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
    
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Run all database setup tasks
 * These are IDEMPOTENT - they check actual data state, not migration tracking
 * Safe to run on every server startup (development and production)
 */
/**
 * Migration: ensure_session_table
 * Creates the session table needed by express-session if it doesn't exist
 * This prevents "already exists" errors during server restart
 */
async function ensureSessionTable() {
  console.log("[Migration] Checking session table...");
  
  try {
    // Create session table if missing (schema compatible with connect-pg-simple)
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS session (
        sid VARCHAR NOT NULL COLLATE "default",
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      )
    `);
    
    // Add primary key if it doesn't exist
    await db.execute(sql`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'session_pkey'
        ) THEN
          ALTER TABLE session ADD CONSTRAINT session_pkey PRIMARY KEY (sid);
        END IF;
      END
      $$;
    `);
    
    // Add index if it doesn't exist
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "IDX_session_expire" ON session (expire)
    `);
    
    console.log("[Migration] ✓ Session table ready");
  } catch (error: any) {
    // Ignore "already exists" errors - these are harmless
    if (error?.message?.includes('already exists')) {
      console.log("[Migration] ✓ Session table already exists");
      return;
    }
    // CRITICAL: Rethrow session table errors - server cannot run without it
    console.error("[Migration] CRITICAL: Failed to create session table:", error);
    throw error;
  }
}

/**
 * Migration: add_all_drawing_category_enum_values
 * Adds all missing values to drawing_category enum: terrein, overig, veiligheid, afwerking
 * This ensures production database has all required enum values before schema sync
 * Renamed from add_drawing_category_enum_values to force re-run with complete value set
 */
async function addDrawingCategoryEnumValues() {
  const migrationName = "add_all_drawing_category_enum_values";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  if (await hasMigrationRun(migrationName)) {
    console.log(`[Migration] ✓ ${migrationName} already completed`);
    return;
  }
  
  try {
    const enumValues = ['terrein', 'overig', 'veiligheid', 'afwerking'];
    
    for (const value of enumValues) {
      // Use sql.raw to build the entire DO block with the value interpolated
      await db.execute(sql.raw(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1 FROM pg_enum 
            WHERE enumlabel = '${value}'
            AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'drawing_category')
          ) THEN
            ALTER TYPE drawing_category ADD VALUE '${value}';
          END IF;
        END
        $$;
      `));
      console.log(`[Migration] ✓ Added '${value}' to drawing_category enum (if missing)`);
    }
    
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Migration: create_rooms_and_terrain_tables
 * Creates rooms and terrain tables for building information management
 */
async function createRoomsAndTerrainTables() {
  const migrationName = "create_rooms_and_terrain_tables";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  if (await hasMigrationRun(migrationName)) {
    console.log(`[Migration] ✓ ${migrationName} already completed`);
    return;
  }
  
  try {
    // Create rooms table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS rooms (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        purpose TEXT,
        gross_floor_area NUMERIC,
        building_id VARCHAR NOT NULL REFERENCES building_data(id) ON DELETE CASCADE,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log(`[Migration] ✓ Created rooms table`);
    
    // Create terrain table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS terrain (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        green_area NUMERIC,
        paved_area NUMERIC,
        play_equipment TEXT[],
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW()
      )
    `);
    
    console.log(`[Migration] ✓ Created terrain table`);
    
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Migration: add_max_students_to_rooms
 * Adds max_students column to rooms table for tracking student capacity
 */
async function addMaxStudentsToRooms() {
  const migrationName = "add_max_students_to_rooms";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  if (await hasMigrationRun(migrationName)) {
    console.log(`[Migration] ✓ ${migrationName} already completed`);
    return;
  }
  
  try {
    // Add max_students column to rooms table
    await db.execute(sql`
      ALTER TABLE rooms 
      ADD COLUMN IF NOT EXISTS max_students INTEGER
    `);
    
    console.log(`[Migration] ✓ Added max_students column to rooms table`);
    
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Migration: create_folders_and_extend_documents
 * Creates folders table and adds folderId + description to documents table
 */
async function createFoldersAndExtendDocuments() {
  const migrationName = "create_folders_and_extend_documents";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  if (await hasMigrationRun(migrationName)) {
    console.log(`[Migration] ✓ ${migrationName} already completed`);
    return;
  }
  
  try {
    // Create folders table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS folders (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        name TEXT NOT NULL,
        school_id VARCHAR NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(name, school_id)
      )
    `);
    
    console.log(`[Migration] ✓ Created folders table with unique constraint`);
    
    // Add folderId and description columns to documents table
    await db.execute(sql`
      ALTER TABLE documents 
      ADD COLUMN IF NOT EXISTS folder_id VARCHAR REFERENCES folders(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS description TEXT
    `);
    
    console.log(`[Migration] ✓ Added folder_id and description columns to documents table`);
    
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Migration: create_investment_years_table
 * Creates investment_years table and removes old budgetedCost/parentInvestmentId from investments
 * This allows multi-year budgets on single investment rows
 */
async function createInvestmentYearsTable() {
  const migrationName = "create_investment_years_table";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  if (await hasMigrationRun(migrationName)) {
    console.log(`[Migration] ✓ ${migrationName} already completed`);
    return;
  }
  
  try {
    // Create investment_years table
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS investment_years (
        id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
        investment_id VARCHAR NOT NULL REFERENCES investments(id) ON DELETE CASCADE,
        year INTEGER NOT NULL,
        amount INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        UNIQUE(investment_id, year)
      )
    `);
    
    console.log(`[Migration] ✓ Created investment_years table`);
    
    // Drop old columns from investments table
    await db.execute(sql`
      ALTER TABLE investments 
      DROP COLUMN IF EXISTS budgeted_cost,
      DROP COLUMN IF EXISTS parent_investment_id
    `);
    
    console.log(`[Migration] ✓ Removed budgeted_cost and parent_investment_id from investments table`);
    
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Migration: fix_invalid_drawing_categories
 * Fixes invalid "onlitigator" value in drawings.category to "beheer"
 * This allows deployment to succeed without schema conflicts
 */
async function fixInvalidDrawingCategories() {
  const migrationName = "fix_invalid_drawing_categories";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  if (await hasMigrationRun(migrationName)) {
    console.log(`[Migration] ✓ ${migrationName} already completed`);
    return;
  }
  
  try {
    // Update any invalid drawing categories to "overig"
    const result = await db.execute(sql`
      UPDATE drawings 
      SET category = 'overig'
      WHERE category NOT IN ('bouwkundig', 'w-installatie', 'e-installatie', 'terrein', 'overig', 'veiligheid', 'afwerking')
    `);
    
    const rowCount = result.rowCount || 0;
    
    if (rowCount > 0) {
      console.log(`[Migration] ✓ Fixed ${rowCount} invalid drawing categories`);
    } else {
      console.log(`[Migration] ✓ No invalid drawing categories found`);
    }
    
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Migration: populate_investment_years
 * Populates investment_years for existing investments that don't have any years
 * This ensures all investments appear in the dashboard and year columns
 */
async function populateInvestmentYears() {
  const migrationName = "populate_investment_years";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  if (await hasMigrationRun(migrationName)) {
    console.log(`[Migration] ✓ ${migrationName} already completed`);
    return;
  }
  
  try {
    // Find all investments that don't have investment_years entries
    const investmentsResult = await db.execute(sql`
      SELECT i.id, i.start_date, i.is_cyclic, i.cycle_years
      FROM investments i
      LEFT JOIN investment_years iy ON i.id = iy.investment_id
      WHERE iy.id IS NULL
      AND i.start_date IS NOT NULL
    `);
    
    const investments = investmentsResult.rows;
    
    if (investments.length === 0) {
      console.log(`[Migration] ✓ No investments need year entries`);
      await markMigrationComplete(migrationName);
      return;
    }
    
    console.log(`[Migration] Found ${investments.length} investments without year entries - populating...`);
    
    for (const investment of investments) {
      const startYear = new Date(investment.start_date as string).getFullYear();
      
      if (investment.is_cyclic && investment.cycle_years) {
        // For cyclic investments, generate multiple years
        const cycleYears = investment.cycle_years as number;
        const maxYear = startYear + 30;
        
        for (let year = startYear; year <= maxYear; year += cycleYears) {
          await db.execute(sql`
            INSERT INTO investment_years (id, investment_id, year, amount, created_at)
            VALUES (gen_random_uuid(), ${investment.id as string}, ${year}, 0, NOW())
            ON CONFLICT DO NOTHING
          `);
        }
      } else {
        // For normal investments, create a single year entry
        await db.execute(sql`
          INSERT INTO investment_years (id, investment_id, year, amount, created_at)
          VALUES (gen_random_uuid(), ${investment.id as string}, ${startYear}, 0, NOW())
          ON CONFLICT DO NOTHING
        `);
      }
    }
    
    console.log(`[Migration] ✓ Populated investment_years for ${investments.length} investments`);
    
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Migration: extend_role_enum_for_rbac
 * Extends the role enum to support admin, directeur, medewerker
 * Converts existing 'user' roles to 'directeur'
 */
async function extendRoleEnumForRbac() {
  const migrationName = "extend_role_enum_for_rbac";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  if (await hasMigrationRun(migrationName)) {
    console.log(`[Migration] ✓ ${migrationName} already completed`);
    return;
  }
  
  try {
    // Check if new enum values already exist
    const enumCheck = await db.execute(sql`
      SELECT enumlabel FROM pg_enum 
      WHERE enumtypid = 'role'::regtype 
      AND enumlabel IN ('directeur', 'medewerker')
    `);
    
    if (enumCheck.rows.length < 2) {
      console.log(`[Migration] Adding new role enum values...`);
      
      // Add new enum values if they don't exist
      try {
        await db.execute(sql`ALTER TYPE role ADD VALUE IF NOT EXISTS 'directeur'`);
        console.log(`[Migration] ✓ Added 'directeur' to role enum`);
      } catch (e) {
        console.log(`[Migration] 'directeur' already exists in role enum`);
      }
      
      try {
        await db.execute(sql`ALTER TYPE role ADD VALUE IF NOT EXISTS 'medewerker'`);
        console.log(`[Migration] ✓ Added 'medewerker' to role enum`);
      } catch (e) {
        console.log(`[Migration] 'medewerker' already exists in role enum`);
      }
    }
    
    // Convert existing 'user' roles to 'directeur'
    const updateResult = await db.execute(sql`
      UPDATE users SET role = 'directeur' WHERE role = 'user'
    `);
    console.log(`[Migration] ✓ Converted ${updateResult.rowCount || 0} users from 'user' to 'directeur'`);
    
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Migration: add_attachment_columns_to_reports_and_maintenance
 * Adds attachment_url and attachment_name columns to reports and maintenance tables
 */
async function addAttachmentColumnsToReportsAndMaintenance() {
  const migrationName = "add_attachment_columns_to_reports_and_maintenance";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  if (await hasMigrationRun(migrationName)) {
    console.log(`[Migration] ✓ ${migrationName} already completed`);
    return;
  }
  
  try {
    // Add columns to reports table
    await db.execute(sql`
      ALTER TABLE reports 
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS attachment_name TEXT
    `);
    
    // Add columns to maintenance table
    await db.execute(sql`
      ALTER TABLE maintenance 
      ADD COLUMN IF NOT EXISTS attachment_url TEXT,
      ADD COLUMN IF NOT EXISTS attachment_name TEXT
    `);
    
    console.log(`[Migration] ✓ Added attachment columns to reports and maintenance tables`);
    
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

/**
 * Migration: fix_jean_admin_role
 * Updates jean@deruiterpartners.nl to have admin role in the database
 * This fixes the role that was incorrectly set when user was auto-created via Supabase Auth
 */
async function fixJeanAdminRole() {
  const migrationName = "fix_jean_admin_role_v2";
  
  console.log(`[Migration] Checking if ${migrationName} needs to run...`);
  
  if (await hasMigrationRun(migrationName)) {
    console.log(`[Migration] ✓ ${migrationName} already completed`);
    return;
  }
  
  try {
    // First check current role
    const checkResult = await db.execute(sql`
      SELECT id, email, role FROM users WHERE LOWER(email) = LOWER('jean@deruiterpartners.nl')
    `);
    console.log(`[Migration] Current jean@deruiterpartners.nl user:`, checkResult.rows);
    
    // Update the user role to admin (force update regardless of current role)
    const result = await db.execute(sql`
      UPDATE users 
      SET role = 'admin' 
      WHERE LOWER(email) = LOWER('jean@deruiterpartners.nl')
      RETURNING id, email, role
    `);
    
    if (result.rows.length > 0) {
      console.log(`[Migration] ✓ Updated jean@deruiterpartners.nl to admin role:`, result.rows[0]);
    } else {
      console.log(`[Migration] ⚠ jean@deruiterpartners.nl user not found in database`);
    }
    
    await markMigrationComplete(migrationName);
    console.log(`[Migration] ✓ ${migrationName} completed successfully`);
  } catch (error) {
    console.error(`[Migration] ✗ Error during ${migrationName}:`, error);
    throw error;
  }
}

export async function runMigrations() {
  console.log("[Migration] Starting database setup checks...");
  
  try {
    // Ensure migration tracking table exists first (CRITICAL)
    await ensureMigrationTable();
    
    // Run CRITICAL migrations first - server cannot run without these
    await createBaseSchema();               // CRITICAL: Create all base tables and enums FIRST
    await ensureSessionTable();             // CRITICAL: Session table must exist (may already be created by base schema)
    await addDrawingCategoryEnumValues();   // CRITICAL: Enum values must exist BEFORE Drizzle auto-migrations
    await seedSchoolsAndBoards();           // CRITICAL: Schools must exist for multi-tenancy (after tables are created)
    
    // Run non-critical setup tasks - failures are logged but don't stop server
    try {
      await seedHardcodedAdminUser();         // Non-critical: Default admin user
      await assignUsersToSchools();           // Non-critical: User assignments
      await ensureSupabaseBucketsForSchools(); // Non-critical: Supabase buckets
      await recalculateBudgetSpentAmounts();  // Non-critical: Budget recalculation
      await createRoomsAndTerrainTables();    // Non-critical: Create rooms and terrain tables
      await addMaxStudentsToRooms();          // Non-critical: Add max_students column to rooms
      await createFoldersAndExtendDocuments(); // Non-critical: Create folders and extend documents
      await createInvestmentYearsTable();     // Non-critical: Create investment_years table
      await fixInvalidDrawingCategories();    // Non-critical: Fix invalid drawing categories
      await populateInvestmentYears();        // Non-critical: Populate investment_years for existing investments
      await addAttachmentColumnsToReportsAndMaintenance(); // Non-critical: Add attachment columns
      await extendRoleEnumForRbac();          // Non-critical: Extend role enum for RBAC
      await fixJeanAdminRole();                 // Non-critical: Fix jean@deruiterpartners.nl admin role
    } catch (nonCriticalError) {
      console.error("[Migration] Non-critical migration failed (server will continue):", nonCriticalError);
    }
    
    console.log("[Migration] Database setup completed successfully ✓");
  } catch (error) {
    // CRITICAL failures - rethrow to prevent server startup
    console.error("[Migration] CRITICAL: Database setup failed - server cannot start:", error);
    throw error;
  }
}

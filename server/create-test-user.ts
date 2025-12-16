import "dotenv/config";
import { createClient } from "@supabase/supabase-js";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function createTestUser() {
  console.log("🔧 Creating test user...\n");

  try {
    // Test user credentials
    const testEmail = "test@eduvium.nl";
    const testPassword = "Test1234!";
    const firstName = "Test";
    const lastName = "User";

    // Check if user already exists in Supabase
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existingUser = existingUsers?.users?.find((u) => u.email === testEmail);

    let supabaseUserId: string;

    if (existingUser) {
      console.log("⚠️  User already exists in Supabase, updating password...");
      supabaseUserId = existingUser.id;
      
      // Update password
      await supabase.auth.admin.updateUserById(existingUser.id, {
        password: testPassword,
      });
    } else {
      // Create user in Supabase Auth
      console.log("📝 Creating user in Supabase Auth...");
      const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
        email: testEmail,
        password: testPassword,
        email_confirm: true, // Auto-confirm email
        user_metadata: {
          first_name: firstName,
          last_name: lastName,
        },
      });

      if (createError) {
        throw new Error(`Failed to create user in Supabase: ${createError.message}`);
      }

      if (!newUser.user) {
        throw new Error("Failed to create user in Supabase");
      }

      supabaseUserId = newUser.user.id;
      console.log("✅ User created in Supabase Auth");
    }

    // Get or create user in local database
    let localUser = await storage.getUserByEmail(testEmail);
    
    if (!localUser) {
      console.log("📝 Creating user in local database...");
      localUser = await storage.createUser({
        id: supabaseUserId,
        email: testEmail,
        password: null, // Supabase handles password
        firstName,
        lastName,
        role: "admin", // Make them admin for testing
      });
      console.log("✅ User created in local database");
    } else {
      console.log("ℹ️  User already exists in local database");
      // Update user ID if it changed
      if (localUser.id !== supabaseUserId) {
        await storage.updateUser(localUser.id, {
          id: supabaseUserId,
        });
        localUser = await storage.getUser(supabaseUserId);
      }
    }

    // Get a school to assign the user to
    const schools = await storage.getAllSchools();
    
    if (schools.length === 0) {
      console.log("⚠️  No schools found. Please run migrations first.");
      return;
    }

    const school = schools[0];
    console.log(`📚 Assigning user to school: ${school.name}`);

    // Check if user-school relationship exists
    const userSchools = await storage.getUserSchools(supabaseUserId);
    const hasSchool = userSchools.some((us) => us.schoolId === school.id);

    if (!hasSchool) {
      // Add user to school
      await storage.addUserSchool({
        userId: supabaseUserId,
        schoolId: school.id,
        isDefault: true,
      });
      console.log("✅ User assigned to school");
    } else {
      console.log("ℹ️  User already assigned to school");
    }

    console.log("\n" + "=".repeat(50));
    console.log("✅ Test user created successfully!");
    console.log("=".repeat(50));
    console.log("\n📧 Login Credentials:");
    console.log(`   Email: ${testEmail}`);
    console.log(`   Password: ${testPassword}`);
    console.log(`   Role: Admin`);
    console.log(`   School: ${school.name}`);
    console.log("\n🚀 You can now login at: http://localhost:5000/login\n");

  } catch (error) {
    console.error("❌ Error creating test user:", error);
    process.exit(1);
  }
}

createTestUser()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });


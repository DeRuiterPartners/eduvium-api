import { storage } from "./storage";
import { hashPassword } from "./auth";

async function seed() {
  console.log("Seeding database...");

  try {
    // Check if data already exists
    const existingUser = await storage.getUserByUsername("admin");
    if (existingUser) {
      console.log("Database already seeded. Skipping...");
      console.log("\nLogin credentials:");
      console.log("Admin - username: admin, password: admin123");
      console.log("User - username: user, password: user123");
      return;
    }

    // Create demo school
    const school = await storage.createSchool({
      name: "Demo Elementary School",
      address: "123 Education Ave, Learning City, ST 12345",
      phone: "(555) 123-4567",
      email: "admin@demoschool.edu",
    });

    console.log("Created demo school:", school.name);

    // Create admin user
    const adminPassword = await hashPassword("admin123");
    const adminUser = await storage.createUser({
      username: "admin",
      password: adminPassword,
      role: "admin",
      schoolId: school.id,
    });

    console.log("Created admin user:", adminUser.username);

    // Create regular user
    const userPassword = await hashPassword("user123");
    const regularUser = await storage.createUser({
      username: "user",
      password: userPassword,
      role: "user",
      schoolId: school.id,
    });

    console.log("Created regular user:", regularUser.username);

    // Create sample maintenance task
    await storage.createMaintenance({
      title: "HVAC System Annual Inspection",
      description: "Annual inspection and maintenance of HVAC system in Building A",
      category: "hvac",
      priority: "high",
      status: "pending",
      location: "Building A - Mechanical Room",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      assignedTo: "HVAC Contractor Inc.",
      schoolId: school.id,
    });

    // Create sample appointment
    await storage.createAppointment({
      title: "Fire Safety Inspection",
      type: "inspection",
      startDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000 + 2 * 60 * 60 * 1000),
      location: "All Buildings",
      attendees: "Fire Marshal, Facility Manager",
      schoolId: school.id,
    });

    // Create sample contract
    await storage.createContract({
      title: "Cleaning Services Contract",
      vendor: "CleanPro Services LLC",
      contractType: "service",
      startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      endDate: new Date(Date.now() + 335 * 24 * 60 * 60 * 1000),
      value: 45000,
      status: "active",
      schoolId: school.id,
    });

    // Create sample report
    await storage.createReport({
      title: "Broken Playground Equipment",
      type: "safety",
      severity: "medium",
      location: "Main Playground",
      description: "Swing set chain showing signs of wear and rust",
      status: "pending",
      schoolId: school.id,
    });

    console.log("Database seeded successfully!");
    console.log("\nLogin credentials:");
    console.log("Admin - username: admin, password: admin123");
    console.log("User - username: user, password: user123");

  } catch (error) {
    console.error("Error seeding database:", error);
    throw error;
  }
}

seed()
  .then(() => {
    console.log("Seed completed");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  });

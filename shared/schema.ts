import { sql } from "drizzle-orm";
import { pgTable, text, varchar, timestamp, integer, boolean, pgEnum, jsonb, index, unique } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Enums
export const roleEnum = pgEnum("role", ["admin", "directeur", "medewerker"]);
export const priorityEnum = pgEnum("priority", ["low", "medium", "high", "critical"]);
export const statusEnum = pgEnum("status", ["pending", "in_progress", "completed", "cancelled"]);
export const investmentStatusEnum = pgEnum("investment_status", ["afwachting", "voorbereiding", "uitvoering", "gereed"]);
export const investmentTypeEnum = pgEnum("investment_type", ["school_wish", "necessary", "sustainability", "advies"]);
export const quoteStatusEnum = pgEnum("quote_status", ["draft", "sent", "accepted", "rejected", "expired"]);
export const installationTypeEnum = pgEnum("installation_type", ["w_installation", "e_installation"]);
export const activityTypeEnum = pgEnum("activity_type", ["onderhoud", "keuring", "opname", "bespreking"]);
export const floorLevelEnum = pgEnum("floor_level", [
  "fundering",
  "begane_grond",
  "eerste_verdieping",
  "tweede_verdieping",
  "dak"
]);
export const drawingCategoryEnum = pgEnum("drawing_category", [
  "bouwkundig",
  "w-installatie",
  "e-installatie",
  "veiligheid",
  "afwerking",
  "terrein",
  "overig"
]);
export const contactCategoryEnum = pgEnum("contact_category", [
  "bouwkundige_aannemer",
  "directie_en_medewerkers",
  "elektrotechnisch",
  "gemeente",
  "inbraak_en_brandveiligheid",
  "schoonmaakdiensten",
  "schilder_en_glaswerken",
  "terrein_inrichting",
  "werktuigbouwkundig",
  "zonwering"
]);

// Boards table (Besturen)
export const boards = pgTable("boards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  address: text("address"),
  phone: text("phone"),
  email: text("email"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Schools table
export const schools = pgTable("schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  boardId: varchar("board_id").references(() => boards.id),
  address: text("address"),
  postalCode: text("postal_code"),
  city: text("city"),
  brinNumber: text("brin_number"),
  phone: text("phone"),
  schoolPhotoUrl: text("school_photo_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"), // nullable for existing users
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: roleEnum("role").notNull().default("medewerker"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User Schools junction table (many-to-many relationship)
export const userSchools = pgTable("user_schools", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").references(() => users.id, { onDelete: "cascade" }).notNull(),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  isDefault: boolean("is_default").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Maintenance table
export const maintenance = pgTable("maintenance", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  priority: priorityEnum("priority").notNull().default("medium"),
  status: statusEnum("status").notNull().default("pending"),
  assignee: text("assignee"),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  dueDate: timestamp("due_date"),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Appointments/Calendar table
export const appointments = pgTable("appointments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  location: text("location"),
  isAllDay: boolean("is_all_day").notNull().default(false),
  activityType: activityTypeEnum("activity_type"),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contracts table
export const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  vendor: text("vendor").notNull(),
  contractType: text("contract_type").notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  amount: integer("amount"),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Reports table
export const reports = pgTable("reports", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description").notNull(),
  location: text("location"),
  priority: priorityEnum("priority").notNull().default("medium"),
  status: statusEnum("status").notNull().default("pending"),
  reportedBy: text("reported_by"),
  maintenanceId: varchar("maintenance_id").references(() => maintenance.id, { onDelete: "cascade" }),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  attachmentUrl: text("attachment_url"),
  attachmentName: text("attachment_name"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Report comments table
export const reportComments = pgTable("report_comments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  reportId: varchar("report_id").references(() => reports.id).notNull(),
  userId: varchar("user_id").references(() => users.id).notNull(),
  content: text("content").notNull(),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Building data table
export const buildingData = pgTable("building_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  buildYear: integer("build_year"),
  grossFloorArea: integer("gross_floor_area"),
  purpose: text("purpose"),
  constructionCompany: text("construction_company"),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Rooms table
export const rooms = pgTable("rooms", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  purpose: text("purpose"),
  grossFloorArea: integer("gross_floor_area").notNull(),
  maxStudents: integer("max_students"),
  buildingId: varchar("building_id").references(() => buildingData.id, { onDelete: "cascade" }).notNull(),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Terrain/outdoor area table
export const terrain = pgTable("terrain", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  greenArea: integer("green_area").notNull().default(0),
  pavedArea: integer("paved_area").notNull().default(0),
  playEquipment: text("play_equipment").array(),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Installation data table
export const installationData = pgTable("installation_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  type: installationTypeEnum("type").notNull().default("w_installation"),
  name: text("name").notNull(),
  brand: text("brand").notNull(),
  model: text("model"),
  installer: text("installer").notNull(),
  inspectionCompany: text("inspection_company"),
  installerDoesInspection: boolean("installer_does_inspection").default(false).notNull(),
  installDate: timestamp("install_date"),
  warrantyUntil: timestamp("warranty_until"),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Contact data table
export const contactData = pgTable("contact_data", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  category: contactCategoryEnum("category").notNull(),
  role: text("role"),
  phone: text("phone"),
  email: text("email"),
  company: text("company"),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Drawings table
export const drawings = pgTable("drawings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  category: drawingCategoryEnum("category").notNull(),
  level: floorLevelEnum("level").notNull(),
  version: text("version").notNull(),
  fileUrl: text("file_url"),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Budget categories table
export const budgetCategories = pgTable("budget_categories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  budget: integer("budget").notNull(),
  spent: integer("spent").notNull().default(0),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Folders table
export const folders = pgTable("folders", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueFolderName: unique().on(table.name, table.schoolId)
}));

// Documents table
export const documents = pgTable("documents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  filename: text("filename").notNull(),
  originalName: text("original_name").notNull(),
  mimeType: text("mime_type").notNull(),
  size: integer("size").notNull(),
  module: text("module").notNull(),
  entityId: varchar("entity_id").notNull(),
  folderId: varchar("folder_id").references((): any => folders.id, { onDelete: "set null" }),
  description: text("description"),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  uploadedBy: varchar("uploaded_by").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Activities table
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  action: text("action").notNull(),
  module: text("module").notNull(),
  entityId: varchar("entity_id"),
  userId: varchar("user_id").references(() => users.id),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Maintenance History table
export const maintenanceHistory = pgTable("maintenance_history", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  location: text("location"),
  category: text("category"),
  company: text("company"),
  completedDate: timestamp("completed_date"),
  cost: integer("cost"),
  investmentId: varchar("investment_id").references((): any => investments.id, { onDelete: "set null" }),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Investments table
export const investments = pgTable("investments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  description: text("description"),
  category: text("category"),
  type: investmentTypeEnum("type").notNull().default("necessary"),
  status: investmentStatusEnum("status").notNull().default("afwachting"),
  startDate: timestamp("start_date"),
  completedDate: timestamp("completed_date"),
  isCyclic: boolean("is_cyclic").notNull().default(false),
  cycleYears: integer("cycle_years"),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Investment Years table (for multi-year budgets on single investment row)
export const investmentYears = pgTable("investment_years", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  investmentId: varchar("investment_id").references(() => investments.id, { onDelete: "cascade" }).notNull(),
  year: integer("year").notNull(),
  amount: integer("amount").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  uniqueInvestmentYear: unique().on(table.investmentId, table.year)
}));

// Year Plan Spreadsheet tables
export const yearPlanColumns = pgTable("year_plan_columns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  type: text("type").notNull().default("text"),
  width: integer("width").default(200),
  order: integer("order").notNull(),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const yearPlanRows = pgTable("year_plan_rows", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  data: jsonb("data").notNull(),
  order: integer("order").notNull(),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Quotes table (Offertes)
export const quotes = pgTable("quotes", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title"),
  description: text("description"),
  category: text("category"),
  vendor: text("vendor").notNull(),
  quotedAmount: integer("quoted_amount").notNull(),
  status: quoteStatusEnum("status").notNull().default("draft"),
  quoteDate: timestamp("quote_date"),
  expiryDate: timestamp("expiry_date"),
  investmentId: varchar("investment_id").references(() => investments.id, { onDelete: "cascade" }),
  schoolId: varchar("school_id").references(() => schools.id, { onDelete: "cascade" }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const upsertUserSchema = createInsertSchema(users).pick({
  id: true,
  email: true,
  password: true,
  firstName: true,
  lastName: true,
  profileImageUrl: true,
  role: true,
});

export const insertBoardSchema = createInsertSchema(boards).omit({
  id: true,
  createdAt: true,
});

export const insertSchoolSchema = createInsertSchema(schools).omit({
  id: true,
  createdAt: true,
});

export const insertMaintenanceSchema = createInsertSchema(maintenance).omit({
  id: true,
  createdAt: true,
});

export const insertAppointmentSchema = createInsertSchema(appointments).omit({
  id: true,
  createdAt: true,
});

export const insertContractSchema = createInsertSchema(contracts).omit({
  id: true,
  createdAt: true,
});

export const insertReportSchema = createInsertSchema(reports).omit({
  id: true,
  createdAt: true,
});

export const insertReportCommentSchema = createInsertSchema(reportComments).omit({
  id: true,
  createdAt: true,
});

export const insertBuildingDataSchema = createInsertSchema(buildingData).omit({
  id: true,
  createdAt: true,
});

export const insertRoomSchema = createInsertSchema(rooms).omit({
  id: true,
  createdAt: true,
});

export const insertTerrainSchema = createInsertSchema(terrain).omit({
  id: true,
  createdAt: true,
});

export const insertInstallationDataSchema = createInsertSchema(installationData).omit({
  id: true,
  createdAt: true,
});

export const insertContactDataSchema = createInsertSchema(contactData).omit({
  id: true,
  createdAt: true,
});

export const insertDrawingSchema = createInsertSchema(drawings).omit({
  id: true,
  createdAt: true,
});

export const insertBudgetCategorySchema = createInsertSchema(budgetCategories).omit({
  id: true,
  createdAt: true,
});

export const insertFolderSchema = createInsertSchema(folders).omit({
  id: true,
  createdAt: true,
});

export const insertDocumentSchema = createInsertSchema(documents).omit({
  id: true,
  createdAt: true,
});

export const insertActivitySchema = createInsertSchema(activities).omit({
  id: true,
  createdAt: true,
});

export const insertMaintenanceHistorySchema = createInsertSchema(maintenanceHistory).omit({
  id: true,
  createdAt: true,
}).extend({
  completedDate: z.union([
    z.string().datetime().transform(str => new Date(str)),
    z.date(),
    z.null(),
    z.undefined()
  ]).optional().nullable(),
});

export const insertInvestmentSchema = createInsertSchema(investments).omit({
  id: true,
  createdAt: true,
}).extend({
  startDate: z.union([
    z.string().datetime().transform(str => new Date(str)),
    z.date(),
    z.null(),
    z.undefined()
  ]).optional().nullable(),
  completedDate: z.union([
    z.string().datetime().transform(str => new Date(str)),
    z.date(),
    z.null(),
    z.undefined()
  ]).optional().nullable(),
  isCyclic: z.boolean().default(false),
  cycleYears: z.number().int().min(1).nullable().optional(),
});

export const insertInvestmentYearSchema = createInsertSchema(investmentYears).omit({
  id: true,
  createdAt: true,
});

export const insertYearPlanColumnSchema = createInsertSchema(yearPlanColumns).omit({
  id: true,
  createdAt: true,
});

export const insertYearPlanRowSchema = createInsertSchema(yearPlanRows).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchoolSchema = createInsertSchema(userSchools).omit({
  id: true,
  createdAt: true,
});

export const insertQuoteSchema = createInsertSchema(quotes).omit({
  id: true,
  createdAt: true,
}).extend({
  investmentId: z.string().min(1, "Investment is required"),
  quoteDate: z.union([
    z.string().datetime().transform(str => new Date(str)),
    z.date(),
    z.null(),
    z.undefined()
  ]).optional().nullable(),
  expiryDate: z.union([
    z.string().datetime().transform(str => new Date(str)),
    z.date(),
    z.null(),
    z.undefined()
  ]).optional().nullable(),
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type UpsertUser = z.infer<typeof upsertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertUserSchool = z.infer<typeof insertUserSchoolSchema>;
export type UserSchool = typeof userSchools.$inferSelect;

export type InsertBoard = z.infer<typeof insertBoardSchema>;
export type Board = typeof boards.$inferSelect;

export type InsertSchool = z.infer<typeof insertSchoolSchema>;
export type School = typeof schools.$inferSelect;

export type InsertMaintenance = z.infer<typeof insertMaintenanceSchema>;
export type Maintenance = typeof maintenance.$inferSelect;

export type InsertAppointment = z.infer<typeof insertAppointmentSchema>;
export type Appointment = typeof appointments.$inferSelect;

export type InsertContract = z.infer<typeof insertContractSchema>;
export type Contract = typeof contracts.$inferSelect;

export type InsertReport = z.infer<typeof insertReportSchema>;
export type Report = typeof reports.$inferSelect;

export type InsertReportComment = z.infer<typeof insertReportCommentSchema>;
export type ReportComment = typeof reportComments.$inferSelect;

export type InsertBuildingData = z.infer<typeof insertBuildingDataSchema>;
export type BuildingData = typeof buildingData.$inferSelect;

export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof rooms.$inferSelect;

export type InsertTerrain = z.infer<typeof insertTerrainSchema>;
export type Terrain = typeof terrain.$inferSelect;

export type InsertInstallationData = z.infer<typeof insertInstallationDataSchema>;
export type InstallationData = typeof installationData.$inferSelect;

export type InsertContactData = z.infer<typeof insertContactDataSchema>;
export type ContactData = typeof contactData.$inferSelect;

export type InsertDrawing = z.infer<typeof insertDrawingSchema>;
export type Drawing = typeof drawings.$inferSelect;

export type InsertBudgetCategory = z.infer<typeof insertBudgetCategorySchema>;
export type BudgetCategory = typeof budgetCategories.$inferSelect;

export type InsertFolder = z.infer<typeof insertFolderSchema>;
export type Folder = typeof folders.$inferSelect;

export type InsertDocument = z.infer<typeof insertDocumentSchema>;
export type Document = typeof documents.$inferSelect;

export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activities.$inferSelect;

export type InsertMaintenanceHistory = z.infer<typeof insertMaintenanceHistorySchema>;
export type MaintenanceHistory = typeof maintenanceHistory.$inferSelect;

export type InsertInvestment = z.infer<typeof insertInvestmentSchema>;
export type Investment = typeof investments.$inferSelect;

export type InsertInvestmentYear = z.infer<typeof insertInvestmentYearSchema>;
export type InvestmentYear = typeof investmentYears.$inferSelect;

export type InsertYearPlanColumn = z.infer<typeof insertYearPlanColumnSchema>;
export type YearPlanColumn = typeof yearPlanColumns.$inferSelect;

export type InsertYearPlanRow = z.infer<typeof insertYearPlanRowSchema>;
export type YearPlanRow = typeof yearPlanRows.$inferSelect;

export type InsertQuote = z.infer<typeof insertQuoteSchema>;
export type Quote = typeof quotes.$inferSelect;

// ============================================================================
// CLIENT-FACING INSERT TYPES (omit server-enforced fields)
// ============================================================================
// These types are used in frontend mutations where schoolId is auto-injected
// by backend from user session. Prevents type mismatches in form handlers.

export type ClientInsertMaintenance = Omit<InsertMaintenance, 'schoolId'>;
export type ClientInsertReport = Omit<InsertReport, 'schoolId'>;
export type ClientInsertAppointment = Omit<InsertAppointment, 'schoolId'>;
export type ClientInsertMaintenanceHistory = Omit<InsertMaintenanceHistory, 'schoolId'>;
export type ClientInsertInvestment = Omit<InsertInvestment, 'schoolId'>;
export type ClientInsertQuote = Omit<InsertQuote, 'schoolId'>;

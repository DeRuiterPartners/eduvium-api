import { eq, and, or, desc, sql, gte, lte } from "drizzle-orm";
import { db } from "./db";
import * as schema from "@shared/schema";
import type {
  User, InsertUser, UpsertUser,
  Board, InsertBoard,
  School, InsertSchool,
  Maintenance, InsertMaintenance,
  Appointment, InsertAppointment,
  Contract, InsertContract,
  Report, InsertReport,
  ReportComment, InsertReportComment,
  BuildingData, InsertBuildingData,
  Room, InsertRoom,
  Terrain, InsertTerrain,
  InstallationData, InsertInstallationData,
  ContactData, InsertContactData,
  Drawing, InsertDrawing,
  BudgetCategory, InsertBudgetCategory,
  Folder, InsertFolder,
  Document, InsertDocument,
  Activity, InsertActivity,
  MaintenanceHistory, InsertMaintenanceHistory,
  Investment, InsertInvestment,
  InvestmentYear, InsertInvestmentYear,
  YearPlanColumn, InsertYearPlanColumn,
  YearPlanRow, InsertYearPlanRow,
  UserSchool, InsertUserSchool,
  Quote, InsertQuote,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUser(userId: string, data: Partial<InsertUser>): Promise<User | undefined>;
  
  // User Schools
  getUserSchools(userId: string): Promise<UserSchool[]>;
  getAllSchoolsForUser(userId: string): Promise<School[]>;
  getAllUserSchools(): Promise<UserSchool[]>;
  addUserSchool(data: InsertUserSchool): Promise<UserSchool>;
  removeUserSchool(id: string): Promise<void>;
  setDefaultSchool(userId: string, schoolId: string): Promise<void>;
  
  // Boards
  getBoard(id: string): Promise<Board | undefined>;
  getAllBoards(): Promise<Board[]>;
  createBoard(board: InsertBoard): Promise<Board>;
  updateBoard(id: string, board: Partial<InsertBoard>): Promise<Board | undefined>;
  deleteBoard(id: string): Promise<void>;
  getSchoolsByBoard(boardId: string): Promise<School[]>;
  
  // Schools
  getSchool(id: string): Promise<School | undefined>;
  getSchoolWithBoard(id: string): Promise<(School & { boardName: string | null }) | undefined>;
  getAllSchools(): Promise<School[]>;
  createSchool(school: InsertSchool): Promise<School>;
  updateSchool(id: string, school: Partial<InsertSchool>): Promise<School | undefined>;
  deleteSchool(id: string): Promise<void>;
  
  // Maintenance
  getMaintenanceBySchool(schoolId: string): Promise<Maintenance[]>;
  getMaintenanceById(id: string): Promise<Maintenance | undefined>;
  createMaintenance(maintenance: InsertMaintenance): Promise<Maintenance>;
  updateMaintenance(id: string, maintenance: Partial<InsertMaintenance>): Promise<Maintenance | undefined>;
  deleteMaintenance(id: string): Promise<void>;
  
  // Appointments
  getAppointmentsBySchool(schoolId: string): Promise<Appointment[]>;
  getAppointmentById(id: string): Promise<Appointment | undefined>;
  createAppointment(appointment: InsertAppointment): Promise<Appointment>;
  updateAppointment(id: string, appointment: Partial<InsertAppointment>): Promise<Appointment | undefined>;
  deleteAppointment(id: string): Promise<void>;
  
  // Contracts
  getContractsBySchool(schoolId: string): Promise<Contract[]>;
  getContractById(id: string): Promise<Contract | undefined>;
  createContract(contract: InsertContract): Promise<Contract>;
  updateContract(id: string, contract: Partial<InsertContract>): Promise<Contract | undefined>;
  deleteContract(id: string): Promise<void>;
  
  // Reports
  getReportsBySchool(schoolId: string): Promise<Report[]>;
  getReportById(id: string): Promise<Report | undefined>;
  createReport(report: InsertReport): Promise<Report>;
  updateReport(id: string, report: Partial<InsertReport>): Promise<Report | undefined>;
  deleteReport(id: string): Promise<void>;
  
  // Report Comments
  getReportComments(reportId: string): Promise<ReportComment[]>;
  createReportComment(comment: InsertReportComment): Promise<ReportComment>;
  
  // Building Data
  getBuildingDataBySchool(schoolId: string): Promise<BuildingData[]>;
  createBuildingData(data: InsertBuildingData): Promise<BuildingData>;
  updateBuildingData(id: string, data: Partial<InsertBuildingData>): Promise<BuildingData | undefined>;
  deleteBuildingData(id: string): Promise<void>;
  
  // Rooms
  getRoomsByBuilding(buildingId: string): Promise<Room[]>;
  getRoomsBySchool(schoolId: string): Promise<Room[]>;
  createRoom(data: InsertRoom): Promise<Room>;
  updateRoom(id: string, data: Partial<InsertRoom>): Promise<Room | undefined>;
  deleteRoom(id: string): Promise<void>;
  
  // Terrain
  getTerrainBySchool(schoolId: string): Promise<Terrain | undefined>;
  createTerrain(data: InsertTerrain): Promise<Terrain>;
  updateTerrain(id: string, data: Partial<InsertTerrain>): Promise<Terrain | undefined>;
  deleteTerrain(id: string): Promise<void>;
  
  // Installation Data
  getInstallationDataBySchool(schoolId: string, type?: string): Promise<InstallationData[]>;
  createInstallationData(data: InsertInstallationData): Promise<InstallationData>;
  updateInstallationData(id: string, data: Partial<InsertInstallationData>): Promise<InstallationData | undefined>;
  deleteInstallationData(id: string): Promise<void>;
  
  // Contact Data
  getContactDataBySchool(schoolId: string): Promise<ContactData[]>;
  createContactData(data: InsertContactData): Promise<ContactData>;
  updateContactData(id: string, data: Partial<InsertContactData>): Promise<ContactData | undefined>;
  deleteContactData(id: string): Promise<void>;
  
  // Drawings
  getDrawingsBySchool(schoolId: string): Promise<Drawing[]>;
  createDrawing(drawing: InsertDrawing): Promise<Drawing>;
  updateDrawing(id: string, drawing: Partial<InsertDrawing>): Promise<Drawing | undefined>;
  deleteDrawing(id: string): Promise<void>;
  
  // Budget Categories
  getBudgetCategoriesBySchool(schoolId: string): Promise<BudgetCategory[]>;
  createBudgetCategory(category: InsertBudgetCategory): Promise<BudgetCategory>;
  
  // Folders
  getFoldersBySchool(schoolId: string): Promise<Folder[]>;
  createFolder(folder: InsertFolder): Promise<Folder>;
  deleteFolder(id: string): Promise<void>;
  
  // Documents
  getDocumentsByEntity(module: string, entityId: string, schoolId: string): Promise<Document[]>;
  getDocumentsBySchool(schoolId: string): Promise<Document[]>;
  getDocumentById(id: string): Promise<Document | undefined>;
  createDocument(document: InsertDocument): Promise<Document>;
  deleteDocument(id: string): Promise<void>;
  
  // Activities
  getActivitiesBySchool(schoolId: string, limit?: number): Promise<Activity[]>;
  createActivity(activity: InsertActivity): Promise<Activity>;
  
  // Maintenance History
  getMaintenanceHistoryBySchool(schoolId: string, startYear?: number, endYear?: number): Promise<MaintenanceHistory[]>;
  getMaintenanceHistoryById(id: string): Promise<MaintenanceHistory | undefined>;
  createMaintenanceHistory(data: InsertMaintenanceHistory): Promise<MaintenanceHistory>;
  updateMaintenanceHistory(id: string, data: Partial<InsertMaintenanceHistory>): Promise<MaintenanceHistory | undefined>;
  deleteMaintenanceHistory(id: string): Promise<void>;
  
  // Investments
  getInvestmentsBySchool(schoolId: string, startYear?: number, endYear?: number): Promise<Investment[]>;
  getInvestmentById(id: string): Promise<Investment | undefined>;
  createInvestment(data: InsertInvestment): Promise<Investment>;
  updateInvestment(id: string, data: Partial<InsertInvestment>): Promise<Investment | undefined>;
  deleteInvestment(id: string): Promise<void>;
  
  // Investment Years
  createInvestmentYear(data: InsertInvestmentYear): Promise<InvestmentYear>;
  getInvestmentYearsByInvestment(investmentId: string): Promise<InvestmentYear[]>;
  deleteInvestmentYearsByInvestment(investmentId: string): Promise<void>;

  // Year Plan Columns
  getYearPlanColumns(schoolId: string): Promise<YearPlanColumn[]>;
  createYearPlanColumn(data: InsertYearPlanColumn): Promise<YearPlanColumn>;
  updateYearPlanColumn(id: string, data: Partial<InsertYearPlanColumn>): Promise<YearPlanColumn | undefined>;
  deleteYearPlanColumn(id: string): Promise<void>;
  reorderYearPlanColumn(id: string, direction: 'up' | 'down'): Promise<void>;

  // Year Plan Rows
  getYearPlanRows(schoolId: string): Promise<YearPlanRow[]>;
  createYearPlanRow(data: InsertYearPlanRow): Promise<YearPlanRow>;
  updateYearPlanRow(id: string, data: Partial<InsertYearPlanRow>): Promise<YearPlanRow | undefined>;
  deleteYearPlanRow(id: string): Promise<void>;
  reorderYearPlanRow(id: string, direction: 'up' | 'down'): Promise<void>;

  // Quotes
  getQuotesBySchool(schoolId: string, startYear?: number, endYear?: number): Promise<Array<{ quote: Quote; investment: Investment | null }>>;
  getQuoteById(id: string): Promise<Quote | undefined>;
  createQuote(data: InsertQuote): Promise<Quote>;
  updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote | undefined>;
  deleteQuote(id: string): Promise<void>;
  getYearPlanRowById(id: string): Promise<YearPlanRow | undefined>;
}

export class DatabaseStorage implements IStorage {
  // Users
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.email, email));
    return user;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db.insert(schema.users).values(insertUser).returning();
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    // First, try to find existing user by id
    let existingUser: User | undefined;
    
    if (userData.id) {
      [existingUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.id, userData.id));
    }

    // If not found by id, try by email
    if (!existingUser && userData.email) {
      [existingUser] = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, userData.email));
    }

    if (existingUser) {
      // Update existing user
      const updateData: Record<string, any> = {
        email: userData.email,
        firstName: userData.firstName,
        lastName: userData.lastName,
        profileImageUrl: userData.profileImageUrl,
        updatedAt: new Date(),
      };
      
      // Only include password if provided
      if (userData.password !== undefined) {
        updateData.password = userData.password;
      }
      
      const [user] = await db
        .update(schema.users)
        .set(updateData)
        .where(eq(schema.users.id, existingUser.id))
        .returning();
      return user;
    } else {
      // Create new user
      const [user] = await db.insert(schema.users).values(userData).returning();
      return user;
    }
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(schema.users);
  }

  async updateUser(userId: string, data: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(schema.users)
      .set(data)
      .where(eq(schema.users.id, userId))
      .returning();
    return user;
  }

  // User Schools
  async getUserSchools(userId: string): Promise<UserSchool[]> {
    return db.select()
      .from(schema.userSchools)
      .where(eq(schema.userSchools.userId, userId))
      .orderBy(desc(schema.userSchools.isDefault));
  }

  async getAllSchoolsForUser(userId: string): Promise<School[]> {
    const userSchools = await db
      .select({
        school: schema.schools,
      })
      .from(schema.userSchools)
      .innerJoin(schema.schools, eq(schema.userSchools.schoolId, schema.schools.id))
      .where(eq(schema.userSchools.userId, userId))
      .orderBy(desc(schema.userSchools.isDefault));
    
    return userSchools.map(us => us.school);
  }

  async getAllUserSchools(): Promise<UserSchool[]> {
    return db.select().from(schema.userSchools);
  }

  async addUserSchool(data: InsertUserSchool): Promise<UserSchool> {
    const [userSchool] = await db.insert(schema.userSchools).values(data).returning();
    return userSchool;
  }

  async removeUserSchool(id: string): Promise<void> {
    await db.delete(schema.userSchools).where(eq(schema.userSchools.id, id));
  }

  async setDefaultSchool(userId: string, schoolId: string): Promise<void> {
    await db.transaction(async (tx) => {
      // First, set all schools to not default for this user
      await tx
        .update(schema.userSchools)
        .set({ isDefault: false })
        .where(eq(schema.userSchools.userId, userId));
      
      // Then set the selected school as default
      await tx
        .update(schema.userSchools)
        .set({ isDefault: true })
        .where(
          and(
            eq(schema.userSchools.userId, userId),
            eq(schema.userSchools.schoolId, schoolId)
          )
        );
    });
  }

  // Boards
  async getBoard(id: string): Promise<Board | undefined> {
    const [board] = await db.select().from(schema.boards).where(eq(schema.boards.id, id));
    return board;
  }

  async getAllBoards(): Promise<Board[]> {
    return db.select().from(schema.boards).orderBy(desc(schema.boards.createdAt));
  }

  async createBoard(insertBoard: InsertBoard): Promise<Board> {
    const [board] = await db.insert(schema.boards).values(insertBoard).returning();
    return board;
  }

  async updateBoard(id: string, updates: Partial<InsertBoard>): Promise<Board | undefined> {
    const [board] = await db.update(schema.boards)
      .set(updates)
      .where(eq(schema.boards.id, id))
      .returning();
    return board;
  }

  async deleteBoard(id: string): Promise<void> {
    // Wrap in transaction to ensure atomicity
    await db.transaction(async (tx) => {
      // First, set boardId to NULL for all schools associated with this board
      await tx
        .update(schema.schools)
        .set({ boardId: null })
        .where(eq(schema.schools.boardId, id));
      
      // Now delete the board
      await tx.delete(schema.boards).where(eq(schema.boards.id, id));
    });
  }

  async getSchoolsByBoard(boardId: string): Promise<School[]> {
    return db.select().from(schema.schools).where(eq(schema.schools.boardId, boardId));
  }

  // Schools
  async getSchool(id: string): Promise<School | undefined> {
    const [school] = await db.select().from(schema.schools).where(eq(schema.schools.id, id));
    return school;
  }

  async getSchoolWithBoard(id: string): Promise<(School & { boardName: string | null }) | undefined> {
    const result = await db
      .select({
        id: schema.schools.id,
        name: schema.schools.name,
        boardId: schema.schools.boardId,
        address: schema.schools.address,
        postalCode: schema.schools.postalCode,
        city: schema.schools.city,
        brinNumber: schema.schools.brinNumber,
        phone: schema.schools.phone,
        schoolPhotoUrl: schema.schools.schoolPhotoUrl,
        createdAt: schema.schools.createdAt,
        boardName: schema.boards.name,
      })
      .from(schema.schools)
      .leftJoin(schema.boards, eq(schema.schools.boardId, schema.boards.id))
      .where(eq(schema.schools.id, id));
    
    return result[0];
  }

  async getAllSchools(): Promise<School[]> {
    return db.select().from(schema.schools);
  }

  async createSchool(insertSchool: InsertSchool): Promise<School> {
    const [school] = await db.insert(schema.schools).values(insertSchool).returning();
    return school;
  }

  async updateSchool(id: string, updates: Partial<InsertSchool>): Promise<School | undefined> {
    const [school] = await db.update(schema.schools)
      .set(updates)
      .where(eq(schema.schools.id, id))
      .returning();
    return school;
  }

  async deleteSchool(id: string): Promise<void> {
    await db.delete(schema.schools).where(eq(schema.schools.id, id));
  }

  // Maintenance
  async getMaintenanceBySchool(schoolId: string): Promise<Maintenance[]> {
    return db.select().from(schema.maintenance)
      .where(eq(schema.maintenance.schoolId, schoolId))
      .orderBy(desc(schema.maintenance.createdAt));
  }

  async getMaintenanceById(id: string): Promise<Maintenance | undefined> {
    const [maintenance] = await db.select().from(schema.maintenance).where(eq(schema.maintenance.id, id));
    return maintenance;
  }

  async createMaintenance(insertMaintenance: InsertMaintenance): Promise<Maintenance> {
    const [maintenance] = await db.insert(schema.maintenance).values(insertMaintenance).returning();
    return maintenance;
  }

  async updateMaintenance(id: string, updates: Partial<InsertMaintenance>): Promise<Maintenance | undefined> {
    const [maintenance] = await db.update(schema.maintenance)
      .set(updates)
      .where(eq(schema.maintenance.id, id))
      .returning();
    return maintenance;
  }

  async deleteMaintenance(id: string): Promise<void> {
    await db.delete(schema.maintenance).where(eq(schema.maintenance.id, id));
  }

  // Appointments
  async getAppointmentsBySchool(schoolId: string): Promise<Appointment[]> {
    return db.select().from(schema.appointments)
      .where(eq(schema.appointments.schoolId, schoolId))
      .orderBy(schema.appointments.startDate);
  }

  async getAppointmentById(id: string): Promise<Appointment | undefined> {
    const [appointment] = await db.select().from(schema.appointments).where(eq(schema.appointments.id, id));
    return appointment;
  }

  async createAppointment(insertAppointment: InsertAppointment): Promise<Appointment> {
    const [appointment] = await db.insert(schema.appointments).values(insertAppointment).returning();
    return appointment;
  }

  async updateAppointment(id: string, updates: Partial<InsertAppointment>): Promise<Appointment | undefined> {
    const [appointment] = await db.update(schema.appointments)
      .set(updates)
      .where(eq(schema.appointments.id, id))
      .returning();
    return appointment;
  }

  async deleteAppointment(id: string): Promise<void> {
    await db.delete(schema.appointments).where(eq(schema.appointments.id, id));
  }

  // Contracts
  async getContractsBySchool(schoolId: string): Promise<Contract[]> {
    return db.select().from(schema.contracts)
      .where(eq(schema.contracts.schoolId, schoolId))
      .orderBy(schema.contracts.endDate);
  }

  async getContractById(id: string): Promise<Contract | undefined> {
    const [contract] = await db.select().from(schema.contracts).where(eq(schema.contracts.id, id));
    return contract;
  }

  async createContract(insertContract: InsertContract): Promise<Contract> {
    const [contract] = await db.insert(schema.contracts).values(insertContract).returning();
    return contract;
  }

  async updateContract(id: string, updates: Partial<InsertContract>): Promise<Contract | undefined> {
    const [contract] = await db.update(schema.contracts)
      .set(updates)
      .where(eq(schema.contracts.id, id))
      .returning();
    return contract;
  }

  async deleteContract(id: string): Promise<void> {
    await db.delete(schema.contracts).where(eq(schema.contracts.id, id));
  }

  // Reports
  async getReportsBySchool(schoolId: string): Promise<Report[]> {
    return db.select().from(schema.reports)
      .where(eq(schema.reports.schoolId, schoolId))
      .orderBy(desc(schema.reports.createdAt));
  }

  async getReportById(id: string): Promise<Report | undefined> {
    const [report] = await db.select().from(schema.reports).where(eq(schema.reports.id, id));
    return report;
  }

  async createReport(insertReport: InsertReport): Promise<Report> {
    const [report] = await db.insert(schema.reports).values(insertReport).returning();
    return report;
  }

  async updateReport(id: string, updates: Partial<InsertReport>): Promise<Report | undefined> {
    const [report] = await db.update(schema.reports)
      .set(updates)
      .where(eq(schema.reports.id, id))
      .returning();
    return report;
  }

  async deleteReport(id: string): Promise<void> {
    await db.delete(schema.reports).where(eq(schema.reports.id, id));
  }

  // Report Comments
  async getReportComments(reportId: string): Promise<ReportComment[]> {
    const comments = await db
      .select({
        id: schema.reportComments.id,
        reportId: schema.reportComments.reportId,
        userId: schema.reportComments.userId,
        content: schema.reportComments.content,
        schoolId: schema.reportComments.schoolId,
        createdAt: schema.reportComments.createdAt,
        userFirstName: schema.users.firstName,
        userLastName: schema.users.lastName,
      })
      .from(schema.reportComments)
      .leftJoin(schema.users, eq(schema.reportComments.userId, schema.users.id))
      .where(eq(schema.reportComments.reportId, reportId))
      .orderBy(schema.reportComments.createdAt);
    
    return comments;
  }

  async createReportComment(insertComment: InsertReportComment): Promise<ReportComment> {
    const [comment] = await db.insert(schema.reportComments).values(insertComment).returning();
    return comment;
  }

  // Building Data
  async getBuildingDataBySchool(schoolId: string): Promise<BuildingData[]> {
    return db.select().from(schema.buildingData)
      .where(eq(schema.buildingData.schoolId, schoolId));
  }

  async createBuildingData(insertData: InsertBuildingData): Promise<BuildingData> {
    const [data] = await db.insert(schema.buildingData).values(insertData).returning();
    return data;
  }

  async updateBuildingData(id: string, updates: Partial<InsertBuildingData>): Promise<BuildingData | undefined> {
    const [data] = await db.update(schema.buildingData)
      .set(updates)
      .where(eq(schema.buildingData.id, id))
      .returning();
    return data;
  }

  async deleteBuildingData(id: string): Promise<void> {
    await db.delete(schema.buildingData).where(eq(schema.buildingData.id, id));
  }

  // Rooms
  async getRoomsByBuilding(buildingId: string): Promise<Room[]> {
    return db.select().from(schema.rooms)
      .where(eq(schema.rooms.buildingId, buildingId));
  }

  async getRoomsBySchool(schoolId: string): Promise<Room[]> {
    return db.select().from(schema.rooms)
      .where(eq(schema.rooms.schoolId, schoolId));
  }

  async createRoom(insertData: InsertRoom): Promise<Room> {
    const [room] = await db.insert(schema.rooms).values(insertData).returning();
    return room;
  }

  async updateRoom(id: string, updates: Partial<InsertRoom>): Promise<Room | undefined> {
    const [room] = await db.update(schema.rooms)
      .set(updates)
      .where(eq(schema.rooms.id, id))
      .returning();
    return room;
  }

  async deleteRoom(id: string): Promise<void> {
    await db.delete(schema.rooms).where(eq(schema.rooms.id, id));
  }

  // Terrain
  async getTerrainBySchool(schoolId: string): Promise<Terrain | undefined> {
    const [terrain] = await db.select().from(schema.terrain)
      .where(eq(schema.terrain.schoolId, schoolId));
    return terrain;
  }

  async createTerrain(insertData: InsertTerrain): Promise<Terrain> {
    const [terrain] = await db.insert(schema.terrain).values(insertData).returning();
    return terrain;
  }

  async updateTerrain(id: string, updates: Partial<InsertTerrain>): Promise<Terrain | undefined> {
    const [terrain] = await db.update(schema.terrain)
      .set(updates)
      .where(eq(schema.terrain.id, id))
      .returning();
    return terrain;
  }

  async deleteTerrain(id: string): Promise<void> {
    await db.delete(schema.terrain).where(eq(schema.terrain.id, id));
  }

  // Installation Data
  async getInstallationDataBySchool(schoolId: string, type?: string): Promise<InstallationData[]> {
    if (type) {
      return db.select().from(schema.installationData)
        .where(and(
          eq(schema.installationData.schoolId, schoolId),
          sql`${schema.installationData.type} = ${type}`
        ));
    }
    return db.select().from(schema.installationData)
      .where(eq(schema.installationData.schoolId, schoolId));
  }

  async createInstallationData(insertData: InsertInstallationData): Promise<InstallationData> {
    const [data] = await db.insert(schema.installationData).values(insertData).returning();
    return data;
  }

  async updateInstallationData(id: string, updates: Partial<InsertInstallationData>): Promise<InstallationData | undefined> {
    const [data] = await db.update(schema.installationData)
      .set(updates)
      .where(eq(schema.installationData.id, id))
      .returning();
    return data;
  }

  async deleteInstallationData(id: string): Promise<void> {
    await db.delete(schema.installationData).where(eq(schema.installationData.id, id));
  }

  // Contact Data
  async getContactDataBySchool(schoolId: string): Promise<ContactData[]> {
    return db.select().from(schema.contactData)
      .where(eq(schema.contactData.schoolId, schoolId));
  }

  async createContactData(insertData: InsertContactData): Promise<ContactData> {
    const [data] = await db.insert(schema.contactData).values(insertData).returning();
    return data;
  }

  async updateContactData(id: string, updates: Partial<InsertContactData>): Promise<ContactData | undefined> {
    const [data] = await db.update(schema.contactData)
      .set(updates)
      .where(eq(schema.contactData.id, id))
      .returning();
    return data;
  }

  async deleteContactData(id: string): Promise<void> {
    await db.delete(schema.contactData).where(eq(schema.contactData.id, id));
  }

  // Drawings
  async getDrawingsBySchool(schoolId: string): Promise<Drawing[]> {
    return db.select().from(schema.drawings)
      .where(eq(schema.drawings.schoolId, schoolId));
  }

  async createDrawing(insertDrawing: InsertDrawing): Promise<Drawing> {
    const [drawing] = await db.insert(schema.drawings).values(insertDrawing).returning();
    return drawing;
  }

  async updateDrawing(id: string, updates: Partial<InsertDrawing>): Promise<Drawing | undefined> {
    const [drawing] = await db.update(schema.drawings)
      .set(updates)
      .where(eq(schema.drawings.id, id))
      .returning();
    return drawing;
  }

  async deleteDrawing(id: string): Promise<void> {
    await db.delete(schema.drawings).where(eq(schema.drawings.id, id));
  }

  // Budget Categories
  async getBudgetCategoriesBySchool(schoolId: string): Promise<BudgetCategory[]> {
    return db.select().from(schema.budgetCategories).where(eq(schema.budgetCategories.schoolId, schoolId));
  }

  async createBudgetCategory(insertCategory: InsertBudgetCategory): Promise<BudgetCategory> {
    const [category] = await db.insert(schema.budgetCategories).values(insertCategory).returning();
    return category;
  }

  // Folders
  async getFoldersBySchool(schoolId: string): Promise<Folder[]> {
    return db.select().from(schema.folders)
      .where(eq(schema.folders.schoolId, schoolId))
      .orderBy(schema.folders.name);
  }

  async createFolder(insertFolder: InsertFolder): Promise<Folder> {
    const [folder] = await db.insert(schema.folders).values(insertFolder).returning();
    return folder;
  }

  async deleteFolder(id: string): Promise<void> {
    await db.delete(schema.folders).where(eq(schema.folders.id, id));
  }

  // Documents
  async getDocumentsByEntity(module: string, entityId: string, schoolId: string): Promise<Document[]> {
    return db.select().from(schema.documents)
      .where(and(
        eq(schema.documents.module, module),
        eq(schema.documents.entityId, entityId),
        eq(schema.documents.schoolId, schoolId)
      ))
      .orderBy(desc(schema.documents.createdAt));
  }

  async getDocumentsBySchool(schoolId: string): Promise<Document[]> {
    return db.select().from(schema.documents)
      .where(eq(schema.documents.schoolId, schoolId))
      .orderBy(desc(schema.documents.createdAt));
  }

  async getDocumentById(id: string): Promise<Document | undefined> {
    const [document] = await db.select().from(schema.documents).where(eq(schema.documents.id, id));
    return document;
  }

  async createDocument(insertDocument: InsertDocument): Promise<Document> {
    const [document] = await db.insert(schema.documents).values(insertDocument).returning();
    return document;
  }

  async deleteDocument(id: string): Promise<void> {
    await db.delete(schema.documents).where(eq(schema.documents.id, id));
  }

  // Activities
  async getActivitiesBySchool(schoolId: string, limit: number = 50): Promise<Activity[]> {
    return db.select().from(schema.activities)
      .where(eq(schema.activities.schoolId, schoolId))
      .orderBy(desc(schema.activities.createdAt))
      .limit(limit);
  }

  async createActivity(insertActivity: InsertActivity): Promise<Activity> {
    const [activity] = await db.insert(schema.activities).values(insertActivity).returning();
    return activity;
  }

  // Helper function to update budget spent amount based on maintenance history
  private async updateBudgetSpent(schoolId: string, category: string, costDelta: number): Promise<void> {
    if (!category || costDelta === 0) return;
    
    // Try to find a matching budget category (case-insensitive)
    const budgetCategories = await db.select()
      .from(schema.budgetCategories)
      .where(eq(schema.budgetCategories.schoolId, schoolId));
    
    // Find a category that matches (case-insensitive)
    const matchingCategory = budgetCategories.find(bc => 
      bc.name.toLowerCase() === category.toLowerCase()
    );
    
    if (matchingCategory) {
      // Update the spent amount
      const newSpent = Math.max(0, matchingCategory.spent + costDelta);
      await db.update(schema.budgetCategories)
        .set({ spent: newSpent })
        .where(eq(schema.budgetCategories.id, matchingCategory.id));
    }
  }

  // Maintenance History
  async getMaintenanceHistoryBySchool(schoolId: string, startYear?: number, endYear?: number): Promise<MaintenanceHistory[]> {
    const conditions = [eq(schema.maintenanceHistory.schoolId, schoolId)];
    
    if (startYear !== undefined && endYear !== undefined) {
      conditions.push(
        sql`EXTRACT(YEAR FROM ${schema.maintenanceHistory.completedDate}) >= ${startYear}`,
        sql`EXTRACT(YEAR FROM ${schema.maintenanceHistory.completedDate}) <= ${endYear}`
      );
    }
    
    return await db.select().from(schema.maintenanceHistory)
      .where(and(...conditions))
      .orderBy(desc(schema.maintenanceHistory.completedDate));
  }

  async getMaintenanceHistoryById(id: string): Promise<MaintenanceHistory | undefined> {
    const [item] = await db.select().from(schema.maintenanceHistory).where(eq(schema.maintenanceHistory.id, id));
    return item;
  }

  async createMaintenanceHistory(data: InsertMaintenanceHistory): Promise<MaintenanceHistory> {
    const [created] = await db.insert(schema.maintenanceHistory).values(data).returning();
    
    // Update budget category spent amount if category and cost are provided
    if (created.category && created.cost && created.schoolId) {
      await this.updateBudgetSpent(created.schoolId, created.category, created.cost);
    }
    
    return created;
  }

  async updateMaintenanceHistory(id: string, data: Partial<InsertMaintenanceHistory>): Promise<MaintenanceHistory | undefined> {
    // Get the old record first to calculate the difference
    const oldRecord = await this.getMaintenanceHistoryById(id);
    
    const [updated] = await db.update(schema.maintenanceHistory)
      .set(data)
      .where(eq(schema.maintenanceHistory.id, id))
      .returning();
    
    // Update budget category spent amount if there's a change
    if (updated && oldRecord && updated.schoolId) {
      // Remove old cost from budget
      if (oldRecord.category && oldRecord.cost) {
        await this.updateBudgetSpent(updated.schoolId, oldRecord.category, -oldRecord.cost);
      }
      
      // Add new cost to budget
      if (updated.category && updated.cost) {
        await this.updateBudgetSpent(updated.schoolId, updated.category, updated.cost);
      }
    }
    
    return updated;
  }

  async deleteMaintenanceHistory(id: string): Promise<void> {
    // Get the record first to update budget
    const record = await this.getMaintenanceHistoryById(id);
    
    await db.delete(schema.maintenanceHistory).where(eq(schema.maintenanceHistory.id, id));
    
    // Update budget category spent amount
    if (record && record.category && record.cost && record.schoolId) {
      await this.updateBudgetSpent(record.schoolId, record.category, -record.cost);
    }
  }

  // Investments
  async getInvestmentsBySchool(schoolId: string, startYear?: number, endYear?: number): Promise<Investment[]> {
    const conditions = [eq(schema.investments.schoolId, schoolId)];
    
    if (startYear !== undefined && endYear !== undefined) {
      // Filter on startDate if available, otherwise fall back to completedDate or createdAt
      conditions.push(
        sql`EXTRACT(YEAR FROM COALESCE(${schema.investments.startDate}, ${schema.investments.completedDate}, ${schema.investments.createdAt})) >= ${startYear}`,
        sql`EXTRACT(YEAR FROM COALESCE(${schema.investments.startDate}, ${schema.investments.completedDate}, ${schema.investments.createdAt})) <= ${endYear}`
      );
    }
    
    return await db.select().from(schema.investments)
      .where(and(...conditions))
      .orderBy(desc(sql`COALESCE(${schema.investments.startDate}, ${schema.investments.completedDate}, ${schema.investments.createdAt})`));
  }

  async getInvestmentById(id: string): Promise<Investment | undefined> {
    const [item] = await db.select().from(schema.investments).where(eq(schema.investments.id, id));
    return item;
  }

  async createInvestment(data: InsertInvestment): Promise<Investment> {
    const [created] = await db.insert(schema.investments).values(data).returning();
    return created;
  }

  async updateInvestment(id: string, data: Partial<InsertInvestment>): Promise<Investment | undefined> {
    const [updated] = await db.update(schema.investments)
      .set(data)
      .where(eq(schema.investments.id, id))
      .returning();
    return updated;
  }

  async deleteInvestment(id: string): Promise<void> {
    // Delete investment years (cascade should handle this but explicit is safer)
    await this.deleteInvestmentYearsByInvestment(id);
    // Delete the investment itself
    await db.delete(schema.investments).where(eq(schema.investments.id, id));
  }
  
  // Investment Years
  async createInvestmentYear(data: InsertInvestmentYear): Promise<InvestmentYear> {
    const [created] = await db.insert(schema.investmentYears).values(data).returning();
    return created;
  }
  
  async getInvestmentYearsByInvestment(investmentId: string): Promise<InvestmentYear[]> {
    return await db.select().from(schema.investmentYears)
      .where(eq(schema.investmentYears.investmentId, investmentId))
      .orderBy(schema.investmentYears.year);
  }
  
  async deleteInvestmentYearsByInvestment(investmentId: string): Promise<void> {
    await db.delete(schema.investmentYears).where(eq(schema.investmentYears.investmentId, investmentId));
  }

  // Year Plan Columns
  async getYearPlanColumns(schoolId: string): Promise<YearPlanColumn[]> {
    return await db.select().from(schema.yearPlanColumns)
      .where(eq(schema.yearPlanColumns.schoolId, schoolId))
      .orderBy(schema.yearPlanColumns.order);
  }

  async createYearPlanColumn(data: InsertYearPlanColumn): Promise<YearPlanColumn> {
    const [created] = await db.insert(schema.yearPlanColumns).values(data).returning();
    return created;
  }

  async updateYearPlanColumn(id: string, data: Partial<InsertYearPlanColumn>): Promise<YearPlanColumn | undefined> {
    const [updated] = await db.update(schema.yearPlanColumns)
      .set(data)
      .where(eq(schema.yearPlanColumns.id, id))
      .returning();
    return updated;
  }

  async deleteYearPlanColumn(id: string): Promise<void> {
    await db.delete(schema.yearPlanColumns).where(eq(schema.yearPlanColumns.id, id));
  }

  async reorderYearPlanColumn(id: string, direction: 'up' | 'down'): Promise<void> {
    // Get the current column
    const [currentColumn] = await db.select().from(schema.yearPlanColumns).where(eq(schema.yearPlanColumns.id, id));
    if (!currentColumn) {
      throw new Error('Column not found');
    }

    // Get all columns for this school, sorted by order
    const allColumns = await db.select().from(schema.yearPlanColumns)
      .where(eq(schema.yearPlanColumns.schoolId, currentColumn.schoolId))
      .orderBy(schema.yearPlanColumns.order);

    // Find current column's position in the sorted array
    const currentIndex = allColumns.findIndex(col => col.id === id);
    if (currentIndex === -1) {
      throw new Error('Column not found in sorted list');
    }

    // Calculate target index
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Check if move is valid
    if (targetIndex < 0 || targetIndex >= allColumns.length) {
      // Can't move further in this direction
      return;
    }

    // Get the column to swap with
    const swapColumn = allColumns[targetIndex];

    // Swap the orders
    await db.update(schema.yearPlanColumns)
      .set({ order: swapColumn.order })
      .where(eq(schema.yearPlanColumns.id, currentColumn.id));

    await db.update(schema.yearPlanColumns)
      .set({ order: currentColumn.order })
      .where(eq(schema.yearPlanColumns.id, swapColumn.id));
  }

  // Year Plan Rows
  async getYearPlanRows(schoolId: string): Promise<YearPlanRow[]> {
    return await db.select().from(schema.yearPlanRows)
      .where(eq(schema.yearPlanRows.schoolId, schoolId))
      .orderBy(schema.yearPlanRows.order);
  }

  async createYearPlanRow(data: InsertYearPlanRow): Promise<YearPlanRow> {
    const [created] = await db.insert(schema.yearPlanRows).values(data).returning();
    return created;
  }

  async updateYearPlanRow(id: string, data: Partial<InsertYearPlanRow>): Promise<YearPlanRow | undefined> {
    const [updated] = await db.update(schema.yearPlanRows)
      .set(data)
      .where(eq(schema.yearPlanRows.id, id))
      .returning();
    return updated;
  }

  async deleteYearPlanRow(id: string): Promise<void> {
    await db.delete(schema.yearPlanRows).where(eq(schema.yearPlanRows.id, id));
  }

  async reorderYearPlanRow(id: string, direction: 'up' | 'down'): Promise<void> {
    // Get the current row
    const [currentRow] = await db.select().from(schema.yearPlanRows).where(eq(schema.yearPlanRows.id, id));
    if (!currentRow) {
      throw new Error('Row not found');
    }

    // Get all rows for this school, sorted by order
    const allRows = await db.select().from(schema.yearPlanRows)
      .where(eq(schema.yearPlanRows.schoolId, currentRow.schoolId))
      .orderBy(schema.yearPlanRows.order);

    // Find current row's position in the sorted array
    const currentIndex = allRows.findIndex(row => row.id === id);
    if (currentIndex === -1) {
      throw new Error('Row not found in sorted list');
    }

    // Calculate target index
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;

    // Check if move is valid
    if (targetIndex < 0 || targetIndex >= allRows.length) {
      // Can't move further in this direction
      return;
    }

    // Get the row to swap with
    const swapRow = allRows[targetIndex];

    // Swap the orders
    await db.update(schema.yearPlanRows)
      .set({ order: swapRow.order })
      .where(eq(schema.yearPlanRows.id, currentRow.id));

    await db.update(schema.yearPlanRows)
      .set({ order: currentRow.order })
      .where(eq(schema.yearPlanRows.id, swapRow.id));
  }

  // Quotes
  async getQuotesBySchool(schoolId: string, startYear?: number, endYear?: number): Promise<Array<{ quote: Quote; investment: Investment | null }>> {
    const conditions = [eq(schema.quotes.schoolId, schoolId)];
    
    if (startYear !== undefined && endYear !== undefined) {
      // Filter on quoteDate if available, otherwise fall back to createdAt
      conditions.push(
        sql`EXTRACT(YEAR FROM COALESCE(${schema.quotes.quoteDate}, ${schema.quotes.createdAt})) >= ${startYear}`,
        sql`EXTRACT(YEAR FROM COALESCE(${schema.quotes.quoteDate}, ${schema.quotes.createdAt})) <= ${endYear}`
      );
    }
    
    return await db.select({
      quote: schema.quotes,
      investment: schema.investments,
    })
      .from(schema.quotes)
      .leftJoin(schema.investments, eq(schema.quotes.investmentId, schema.investments.id))
      .where(and(...conditions))
      .orderBy(desc(sql`COALESCE(${schema.quotes.quoteDate}, ${schema.quotes.createdAt})`));
  }

  async getQuoteById(id: string): Promise<Quote | undefined> {
    const [item] = await db.select().from(schema.quotes).where(eq(schema.quotes.id, id));
    return item;
  }

  async createQuote(data: InsertQuote): Promise<Quote> {
    const [created] = await db.insert(schema.quotes).values(data).returning();
    return created;
  }

  async updateQuote(id: string, data: Partial<InsertQuote>): Promise<Quote | undefined> {
    const [updated] = await db.update(schema.quotes)
      .set(data)
      .where(eq(schema.quotes.id, id))
      .returning();
    return updated;
  }

  async deleteQuote(id: string): Promise<void> {
    await db.delete(schema.quotes).where(eq(schema.quotes.id, id));
  }

  async getYearPlanRowById(id: string): Promise<YearPlanRow | undefined> {
    const [row] = await db.select().from(schema.yearPlanRows).where(eq(schema.yearPlanRows.id, id));
    return row;
  }
}

export const storage = new DatabaseStorage();

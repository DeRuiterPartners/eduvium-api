import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { db } from "./db";
import { sql } from "drizzle-orm";
import { z } from "zod";
import { fromZodError } from "zod-validation-error";
import { hashPassword, comparePassword, isAuthenticated, requireSchoolAccess, requireAdmin, requirePageAccess } from "./auth";
import { getSupabaseUser, verifySupabaseAuth, extractToken, verifySupabaseToken } from "./supabase-auth";
import { createClient } from "@supabase/supabase-js";
import {
  insertMaintenanceSchema,
  insertAppointmentSchema,
  insertContractSchema,
  insertReportSchema,
  insertReportCommentSchema,
  insertBuildingDataSchema,
  insertRoomSchema,
  insertTerrainSchema,
  insertInstallationDataSchema,
  insertContactDataSchema,
  insertDrawingSchema,
  insertBudgetCategorySchema,
  insertFolderSchema,
  insertUserSchema,
  insertBoardSchema,
  insertSchoolSchema,
  insertMaintenanceHistorySchema,
  insertInvestmentSchema,
  insertYearPlanColumnSchema,
  insertYearPlanRowSchema,
  insertUserSchoolSchema,
  insertQuoteSchema,
  type User,
  type InsertUser,
  type InsertUserSchool,
  type Investment,
  type InsertInvestment,
} from "@shared/schema";
import type {
  AvailableYearsResult,
  MaintenanceByMonthResult,
  ReportsByPriorityResult,
  MaintenanceStatusResult,
  BudgetOverviewResult,
  InvestmentsSummaryResult,
  InvestmentsTotalResult,
  ReportsByMonthResult,
} from "@shared/analytics-types";
import multer from "multer";
import { randomUUID } from "crypto";
import { writeFile, readFile, unlink } from "fs/promises";
import { join } from "path";
import { mkdir } from "fs/promises";
import * as supabaseStorage from "./supabase-storage";

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'text/csv',
];

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 30 * 1024 * 1024 }, // 30MB
  fileFilter: (req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type ${file.mimetype} not allowed`));
    }
  }
});

// Helper to ensure upload directory exists
const UPLOAD_DIR = join(process.cwd(), "uploads");
mkdir(UPLOAD_DIR, { recursive: true }).catch(console.error);

// Helper to get typed user from request session or Supabase
async function getUser(req: Request): Promise<User | null> {
  // Try Supabase Auth first
  const supabaseUser = await getSupabaseUser(req);
  if (supabaseUser) {
    return supabaseUser;
  }
  
  // Fallback to session-based auth
  if (!req.session?.userId) return null;
  const user = await storage.getUser(req.session.userId);
  return user ?? null;
}

// Helper to get active school ID - returns user's default school from database
async function getActiveSchoolId(req: Request): Promise<string | null> {
  const user = await getUser(req);
  if (!user) return null;
  
  // Get user's schools (ordered by isDefault DESC, so default school is first)
  const schools = await storage.getAllSchoolsForUser(user.id);
  return schools[0]?.id ?? null;
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Landing page redirect endpoint
  // This allows eduvium.nl/login to redirect to the application login page
  // Note: This endpoint is for when landing page and app are on same domain
  // For different domains, use direct link on landing page
  app.get('/login', (req: Request, res: Response) => {
    // Check if this is a request from the landing page domain
    const referer = req.get('referer') || '';
    const isFromLandingPage = referer.includes('eduvium.nl') || referer.includes('landingspagina.replit.app');
    
    // Get the application URL from environment or construct from request
    const appUrl = process.env.APP_URL || 
                   (req.get('host') ? `https://${req.get('host')}` : `http://localhost:${process.env.PORT || 5000}`);
    
    // If coming from landing page, redirect to app login
    // Otherwise, serve the login page normally
    if (isFromLandingPage && process.env.APP_URL) {
      res.redirect(`${process.env.APP_URL}/login`);
    } else {
      // This will be handled by the frontend router
      res.redirect('/login');
    }
  });

  // Auth routes
  // Initialize Supabase client for auth
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseClient = supabaseUrl && supabaseServiceKey 
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { autoRefreshToken: false, persistSession: false }
      })
    : null;

  app.post('/api/auth/register', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      // Validate input
      if (!email || !password) {
        res.status(400).json({ message: "Email en wachtwoord zijn verplicht" });
        return;
      }
      
      if (password.length < 8) {
        res.status(400).json({ message: "Wachtwoord moet minimaal 8 karakters zijn" });
        return;
      }
      
      // Check if user already exists in local database
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        res.status(400).json({ message: "Dit email adres is al in gebruik" });
        return;
      }
      
      // Register with Supabase Auth
      if (supabaseClient) {
        const { data: supabaseUser, error: supabaseError } = await supabaseClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true, // Auto-confirm email
          user_metadata: {
            first_name: firstName || "",
            last_name: lastName || "",
          },
        });
        
        if (supabaseError) {
          res.status(400).json({ message: supabaseError.message || "Registratie mislukt" });
          return;
        }
        
        // Create user in local database with Supabase user ID
        const newUser = await storage.upsertUser({
          id: supabaseUser.user.id,
          email,
          password: null, // No password stored locally, Supabase handles it
          firstName: firstName || null,
          lastName: lastName || null,
          role: "medewerker",
        });
        
        res.status(201).json({ 
          message: "Account aangemaakt. Neem contact op met een beheerder om toegang tot een school te krijgen.",
          userId: newUser.id 
        });
      } else {
        // Fallback to old method if Supabase not configured
        const hashedPassword = await hashPassword(password);
        const newUser = await storage.upsertUser({
          id: undefined as any,
          email,
          password: hashedPassword,
          firstName: firstName || null,
          lastName: lastName || null,
          role: "medewerker",
        });
        
        res.status(201).json({ 
          message: "Account aangemaakt. Neem contact op met een beheerder om toegang tot een school te krijgen.",
          userId: newUser.id 
        });
      }
    } catch (error: unknown) {
      next(error);
    }
  });
  
  app.post('/api/auth/login', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        res.status(400).json({ message: "Email en wachtwoord zijn verplicht" });
        return;
      }
      
      // Try Supabase Auth first
      if (supabaseClient) {
        const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
          email,
          password,
        });
        
        if (authError || !authData.user) {
          res.status(401).json({ message: "Ongeldige inloggegevens" });
          return;
        }
        
        // Get or create user in local database
        let localUser = await storage.getUserByEmail(email);
        if (!localUser) {
          localUser = await storage.upsertUser({
            id: authData.user.id,
            email,
            password: null, // Supabase handles password
            firstName: authData.user.user_metadata?.first_name || null,
            lastName: authData.user.user_metadata?.last_name || null,
            role: "medewerker",
          });
        }
        
        // Create session for backward compatibility
        req.session.userId = localUser.id;
        
        // Return user and Supabase session
        const { password: _, ...userWithoutPassword } = localUser;
        res.status(200).json({
          ...userWithoutPassword,
          session: authData.session, // Include Supabase session for client
        });
      } else {
        // Fallback to old password-based auth
        const user = await storage.getUserByEmail(email);
        if (!user || !user.password) {
          res.status(401).json({ message: "Ongeldige inloggegevens" });
          return;
        }
        
        const isValidPassword = await comparePassword(password, user.password);
        if (!isValidPassword) {
          res.status(401).json({ message: "Ongeldige inloggegevens" });
          return;
        }
        
        req.session.userId = user.id;
        const { password: _, ...userWithoutPassword } = user;
        res.status(200).json(userWithoutPassword);
      }
    } catch (error: unknown) {
      next(error);
    }
  });
  
  app.post('/api/auth/logout', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      req.session.destroy((err) => {
        if (err) {
          res.status(500).json({ message: "Logout mislukt" });
          return;
        }
        res.status(200).json({ message: "Uitgelogd" });
      });
    } catch (error: unknown) {
      next(error);
    }
  });
  
  app.get('/api/auth/user', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Try Supabase Auth first
      const supabaseUser = await getSupabaseUser(req);
      if (supabaseUser) {
        const { password: _, ...userWithoutPassword } = supabaseUser;
        res.status(200).json(userWithoutPassword);
        return;
      }
      
      // Fallback to session-based auth
      if (!req.session?.userId) {
        res.status(401).json({ message: "Unauthorized", needsLogin: true });
        return;
      }
      
      const user = await getUser(req);
      if (!user) {
        res.status(401).json({ message: "Unauthorized", needsLogin: true });
        return;
      }
      
      // Return user without password
      const { password: _, ...userWithoutPassword } = user;
      res.status(200).json(userWithoutPassword);
    } catch (error: unknown) {
      next(error);
    }
  });

  // Maintenance routes (protected)
  app.get("/api/maintenance", isAuthenticated, requireSchoolAccess, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }
      
      const tasks = await storage.getMaintenanceBySchool(schoolId);
      res.json(tasks);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/maintenance", isAuthenticated, requireSchoolAccess, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      // Convert string dates to Date objects
      const bodyWithDates = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
        schoolId
      };

      const result = insertMaintenanceSchema.safeParse(bodyWithDates);
      if (!result.success) {
        res.status(400).send(fromZodError(result.error).toString());
        return;
      }

      const task = await storage.createMaintenance(result.data);
      res.json(task);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/maintenance/:id", isAuthenticated, requireSchoolAccess, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Convert string dates to Date objects
      const bodyWithDates = {
        ...req.body,
        dueDate: req.body.dueDate ? new Date(req.body.dueDate) : undefined,
      };
      
      const task = await storage.updateMaintenance(req.params.id, bodyWithDates);
      if (!task) {
        res.status(404).send("Not found");
        return;
      }
      res.json(task);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/maintenance/:id", isAuthenticated, requireSchoolAccess, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await storage.deleteMaintenance(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Upload attachment for maintenance task
  app.post("/api/maintenance/:id/attachment", upload.single("file"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      if (!req.file) {
        res.status(400).send("No file uploaded");
        return;
      }

      const task = await storage.getMaintenanceById(req.params.id);
      if (!task) {
        res.status(404).send("Maintenance task not found");
        return;
      }

      // Generate unique filename
      const fileExt = req.file.originalname.split('.').pop() || '';
      const uniqueFilename = `${randomUUID()}.${fileExt}`;
      const bucketName = `school-${schoolId.replace(/-/g, '')}`;

      // Upload to Supabase Storage
      const fileUrl = await supabaseStorage.uploadFile(
        bucketName,
        "maintenance",
        uniqueFilename,
        req.file.buffer,
        req.file.mimetype
      );

      // Update maintenance with attachment URL
      const updatedTask = await storage.updateMaintenance(req.params.id, {
        attachmentUrl: fileUrl,
        attachmentName: req.file.originalname,
      });

      res.json(updatedTask);
    } catch (error) {
      next(error);
    }
  });

  // Appointments routes
  app.get("/api/appointments", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const appointments = await storage.getAppointmentsBySchool(schoolId);
      res.json(appointments);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/appointments", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      // Convert string dates to Date objects
      const bodyWithDates = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        schoolId
      };

      const result = insertAppointmentSchema.safeParse(bodyWithDates);
      if (!result.success) {
        const errorMessage = fromZodError(result.error).toString();
        console.log("Validation error:", errorMessage);
        console.log("Request body:", bodyWithDates);
        return res.status(400).send(errorMessage);
      }

      const appointment = await storage.createAppointment(result.data);
      res.json(appointment);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/appointments/:id", async (req, res, next) => {
    try {
      // Convert string dates to Date objects
      const bodyWithDates = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      };
      
      const appointment = await storage.updateAppointment(req.params.id, bodyWithDates);
      if (!appointment) return res.status(404).send("Not found");
      res.json(appointment);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/appointments/:id", async (req, res, next) => {
    try {
      await storage.deleteAppointment(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Contracts routes
  app.get("/api/contracts", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const contracts = await storage.getContractsBySchool(schoolId);
      res.json(contracts);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/contracts", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      // Convert string dates to Date objects
      const bodyWithDates = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
        schoolId
      };

      const result = insertContractSchema.safeParse(bodyWithDates);
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const contract = await storage.createContract(result.data);
      res.json(contract);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/contracts/:id", async (req, res, next) => {
    try {
      // Convert string dates to Date objects
      const bodyWithDates = {
        ...req.body,
        startDate: req.body.startDate ? new Date(req.body.startDate) : undefined,
        endDate: req.body.endDate ? new Date(req.body.endDate) : undefined,
      };
      
      const contract = await storage.updateContract(req.params.id, bodyWithDates);
      if (!contract) return res.status(404).send("Not found");
      res.json(contract);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/contracts/:id", async (req, res, next) => {
    try {
      await storage.deleteContract(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Reports routes
  app.get("/api/reports", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }
      
      const reports = await storage.getReportsBySchool(schoolId);
      res.json(reports);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/reports", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      const result = insertReportSchema.safeParse({ ...req.body, schoolId });
      if (!result.success) {
        res.status(400).send(fromZodError(result.error).toString());
        return;
      }

      const report = await storage.createReport(result.data);
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/reports/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const report = await storage.updateReport(req.params.id, req.body);
      if (!report) {
        res.status(404).send("Not found");
        return;
      }
      res.json(report);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/reports/:id", async (req, res, next) => {
    try {
      await storage.deleteReport(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Upload attachment for report
  app.post("/api/reports/:id/attachment", upload.single("file"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      if (!req.file) {
        res.status(400).send("No file uploaded");
        return;
      }

      const report = await storage.getReportById(req.params.id);
      if (!report) {
        res.status(404).send("Report not found");
        return;
      }

      // Generate unique filename
      const fileExt = req.file.originalname.split('.').pop() || '';
      const uniqueFilename = `${randomUUID()}.${fileExt}`;
      const bucketName = `school-${schoolId.replace(/-/g, '')}`;

      // Upload to Supabase Storage
      const fileUrl = await supabaseStorage.uploadFile(
        bucketName,
        "reports",
        uniqueFilename,
        req.file.buffer,
        req.file.mimetype
      );

      // Update report with attachment URL
      const updatedReport = await storage.updateReport(req.params.id, {
        attachmentUrl: fileUrl,
        attachmentName: req.file.originalname,
      });

      res.json(updatedReport);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/reports/:id/create-maintenance", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const report = await storage.getReportById(req.params.id);
      if (!report) return res.status(404).send("Report not found");

      // Create maintenance from report data
      const maintenanceData = {
        title: report.title,
        description: report.description || "",
        location: report.location || "",
        priority: report.priority,
        status: "pending" as const,
        schoolId: report.schoolId,
      };

      const maintenance = await storage.createMaintenance(maintenanceData);

      // Link report to maintenance
      await storage.updateReport(req.params.id, {
        maintenanceId: maintenance.id,
      });

      res.json(maintenance);
    } catch (error) {
      next(error);
    }
  });

  // Report comments routes
  app.get("/api/reports/:reportId/comments", async (req, res, next) => {
    try {
      const comments = await storage.getReportComments(req.params.reportId);
      res.json(comments);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/reports/:reportId/comments", async (req, res, next) => {
    try {
      const user = await getUser(req);
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      if (!user?.id) return res.status(401).send("User not authenticated");

      const result = insertReportCommentSchema.safeParse({
        ...req.body,
        reportId: req.params.reportId,
        userId: user.id,
        schoolId,
      });

      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).message);
      }

      const comment = await storage.createReportComment(result.data);
      res.json(comment);
    } catch (error) {
      next(error);
    }
  });

  // Building data routes
  app.get("/api/building-data", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const data = await storage.getBuildingDataBySchool(schoolId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/building-data", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const result = insertBuildingDataSchema.safeParse({ ...req.body, schoolId });
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const data = await storage.createBuildingData(result.data);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/building-data/:id", async (req, res, next) => {
    try {
      const data = await storage.updateBuildingData(req.params.id, req.body);
      if (!data) return res.status(404).send("Not found");
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/building-data/:id", async (req, res, next) => {
    try {
      await storage.deleteBuildingData(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Rooms routes
  app.get("/api/rooms", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const buildingId = req.query.buildingId as string | undefined;
      const rooms = buildingId 
        ? await storage.getRoomsByBuilding(buildingId)
        : await storage.getRoomsBySchool(schoolId);
      res.json(rooms);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/rooms", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const result = insertRoomSchema.safeParse({ ...req.body, schoolId });
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const room = await storage.createRoom(result.data);
      res.json(room);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/rooms/:id", async (req, res, next) => {
    try {
      const room = await storage.updateRoom(req.params.id, req.body);
      if (!room) return res.status(404).send("Not found");
      res.json(room);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/rooms/:id", async (req, res, next) => {
    try {
      await storage.deleteRoom(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Terrain routes
  app.get("/api/terrain", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const terrain = await storage.getTerrainBySchool(schoolId);
      res.json(terrain);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/terrain", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const result = insertTerrainSchema.safeParse({ ...req.body, schoolId });
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const terrain = await storage.createTerrain(result.data);
      res.json(terrain);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/terrain/:id", async (req, res, next) => {
    try {
      const terrain = await storage.updateTerrain(req.params.id, req.body);
      if (!terrain) return res.status(404).send("Not found");
      res.json(terrain);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/terrain/:id", async (req, res, next) => {
    try {
      await storage.deleteTerrain(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Installation data routes
  app.get("/api/installation-data", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const type = req.query.type as string | undefined;
      const data = await storage.getInstallationDataBySchool(schoolId, type);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/installation-data", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      // Convert string dates to Date objects
      const bodyWithDates = {
        ...req.body,
        installDate: req.body.installDate ? new Date(req.body.installDate) : undefined,
        warrantyUntil: req.body.warrantyUntil ? new Date(req.body.warrantyUntil) : undefined,
        schoolId
      };

      const result = insertInstallationDataSchema.safeParse(bodyWithDates);
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const data = await storage.createInstallationData(result.data);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/installation-data/:id", async (req, res, next) => {
    try {
      // Convert string dates to Date objects
      const bodyWithDates = {
        ...req.body,
        installDate: req.body.installDate ? new Date(req.body.installDate) : undefined,
        warrantyUntil: req.body.warrantyUntil ? new Date(req.body.warrantyUntil) : undefined,
      };
      
      const data = await storage.updateInstallationData(req.params.id, bodyWithDates);
      if (!data) return res.status(404).send("Not found");
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/installation-data/:id", async (req, res, next) => {
    try {
      await storage.deleteInstallationData(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Contact data routes
  app.get("/api/contact-data", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const data = await storage.getContactDataBySchool(schoolId);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/contact-data", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const result = insertContactDataSchema.safeParse({ ...req.body, schoolId });
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const data = await storage.createContactData(result.data);
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/contact-data/:id", async (req, res, next) => {
    try {
      const data = await storage.updateContactData(req.params.id, req.body);
      if (!data) return res.status(404).send("Not found");
      res.json(data);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/contact-data/:id", async (req, res, next) => {
    try {
      await storage.deleteContactData(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Drawings routes
  app.get("/api/drawings", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const drawings = await storage.getDrawingsBySchool(schoolId);
      res.json(drawings);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/drawings", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const result = insertDrawingSchema.safeParse({ ...req.body, schoolId });
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const drawing = await storage.createDrawing(result.data);
      res.json(drawing);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/drawings/:id", async (req, res, next) => {
    try {
      const drawing = await storage.updateDrawing(req.params.id, req.body);
      if (!drawing) return res.status(404).send("Not found");
      res.json(drawing);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/drawings/:id", async (req, res, next) => {
    try {
      await storage.deleteDrawing(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Budget categories routes
  app.get("/api/budget-categories", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const categories = await storage.getBudgetCategoriesBySchool(schoolId);
      res.json(categories);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/budget-categories", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const result = insertBudgetCategorySchema.safeParse({ ...req.body, schoolId });
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const category = await storage.createBudgetCategory(result.data);
      res.json(category);
    } catch (error) {
      next(error);
    }
  });

  // Helper function to get bucket name from school
  function getBucketName(schoolId: string, schoolName?: string): string {
    // Use school ID as bucket name (sanitized)
    return `school-${schoolId.replace(/-/g, "")}`;
  }

  // Document routes
  app.post("/api/:module/:entityId/documents", upload.single("file"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let uploadedToSupabase = false;
    let filename = "";
    let bucketName = "";
    let module = "";
    
    try {
      if (!req.file) {
        res.status(400).send("No file uploaded");
        return;
      }

      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      // Get school
      const school = await storage.getSchool(schoolId);
      if (!school) {
        res.status(400).send("School not found");
        return;
      }

      filename = `${randomUUID()}-${req.file.originalname}`;
      bucketName = getBucketName(schoolId, school.name);
      module = req.params.module;
      
      // Upload to Supabase Storage
      const fileUrl = await supabaseStorage.uploadFile(
        bucketName,
        module,
        filename,
        req.file.buffer,
        req.file.mimetype
      );
      uploadedToSupabase = true;

      try {
        const user = await getUser(req);
        const document = await storage.createDocument({
          filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          module,
          entityId: req.params.entityId,
          schoolId,
          uploadedBy: user?.id || null,
        });

        res.json(document);
      } catch (dbError) {
        // Cleanup Supabase file if database insert fails
        if (uploadedToSupabase) {
          await supabaseStorage.deleteFile(bucketName, module, filename).catch(() => {});
        }
        throw dbError;
      }
    } catch (error) {
      next(error);
    }
  });

  // Folder routes
  app.get("/api/folders", isAuthenticated, requireSchoolAccess, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }
      
      const folders = await storage.getFoldersBySchool(schoolId);
      res.json(folders);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/folders", isAuthenticated, requireSchoolAccess, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }
      
      const folderData = insertFolderSchema.parse({
        ...req.body,
        schoolId
      });
      
      const folder = await storage.createFolder(folderData);
      res.status(201).json(folder);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/folders/:id", isAuthenticated, requireSchoolAccess, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }
      
      // Check if folder belongs to user's school (authorization)
      const folders = await storage.getFoldersBySchool(schoolId);
      const folder = folders.find(f => f.id === req.params.id);
      if (!folder || folder.schoolId !== schoolId) {
        res.status(404).send("Folder not found or access denied");
        return;
      }
      
      // Check if folder has documents
      const documents = await storage.getDocumentsBySchool(schoolId);
      const folderDocuments = documents.filter(doc => doc.folderId === req.params.id);
      if (folderDocuments.length > 0) {
        res.status(400).send(`Cannot delete folder with ${folderDocuments.length} document(s). Please move or delete documents first.`);
        return;
      }
      
      await storage.deleteFolder(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/documents", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }
      
      const documents = await storage.getDocumentsBySchool(schoolId);
      res.json(documents);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/:module/:entityId/documents", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }
      
      const documents = await storage.getDocumentsByEntity(req.params.module, req.params.entityId, schoolId);
      res.json(documents);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/documents/upload", upload.single("file"), async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    let uploadedToSupabase = false;
    let filename = "";
    let bucketName = "";
    let module = "";
    
    try {
      if (!req.file) {
        res.status(400).send("No file uploaded");
        return;
      }

      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      // Get school
      const school = await storage.getSchool(schoolId);
      if (!school) {
        res.status(400).send("School not found");
        return;
      }

      filename = `${randomUUID()}-${req.file.originalname}`;
      bucketName = getBucketName(schoolId, school.name);
      module = req.body.module || "general";
      
      // Upload to Supabase Storage
      const fileUrl = await supabaseStorage.uploadFile(
        bucketName,
        module,
        filename,
        req.file.buffer,
        req.file.mimetype
      );
      uploadedToSupabase = true;

      try {
        const user = await getUser(req);
        const document = await storage.createDocument({
          filename,
          originalName: req.file.originalname,
          mimeType: req.file.mimetype,
          size: req.file.size,
          module,
          entityId: req.body.entityId || "standalone",
          schoolId,
          uploadedBy: user?.id || null,
          folderId: req.body.folderId || null,
          description: req.body.description || null,
        });

        res.json(document);
      } catch (dbError) {
        // Cleanup Supabase file if database insert fails
        if (uploadedToSupabase) {
          await supabaseStorage.deleteFile(bucketName, module, filename).catch(() => {});
        }
        throw dbError;
      }
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/documents/:id/download", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const document = await storage.getDocumentById(req.params.id);
      if (!document) {
        res.status(404).send("Document not found");
        return;
      }

      // Security: Verify document belongs to user's school
      const userSchoolId = await getActiveSchoolId(req);
      if (document.schoolId !== userSchoolId) {
        res.status(403).send("Unauthorized");
        return;
      }

      // Get school
      const school = await storage.getSchool(document.schoolId);
      if (!school) {
        res.status(404).send("School not found");
        return;
      }

      let fileBuffer: Buffer;
      const bucketName = getBucketName(document.schoolId, school.name);

      // Try Supabase Storage first
      try {
        fileBuffer = await supabaseStorage.downloadFile(
          bucketName,
          document.module,
          document.filename
        );
      } catch (supabaseError) {
        // Fallback to local filesystem for legacy documents
        console.log(`Supabase download failed, trying local filesystem: ${supabaseError}`);
        const filepath = join(UPLOAD_DIR, document.filename);
        fileBuffer = await readFile(filepath).catch(() => {
          throw new Error("File not found in Supabase Storage or local filesystem");
        });
      }

      res.setHeader("Content-Type", document.mimeType);
      res.setHeader("Content-Disposition", `attachment; filename="${document.originalName}"`);
      res.send(fileBuffer);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/documents/:id", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const document = await storage.getDocumentById(req.params.id);
      if (!document) {
        res.status(404).send("Document not found");
        return;
      }

      // Security: Verify document belongs to user's school
      const userSchoolId = await getActiveSchoolId(req);
      if (document.schoolId !== userSchoolId) {
        res.status(403).send("Unauthorized");
        return;
      }

      // Get school
      const school = await storage.getSchool(document.schoolId);
      if (!school) {
        res.status(404).send("School not found");
        return;
      }

      const bucketName = getBucketName(document.schoolId, school.name);

      // Try to delete from Supabase Storage
      await supabaseStorage.deleteFile(
        bucketName,
        document.module,
        document.filename
      ).catch((err) => {
        console.log(`Failed to delete from Supabase, trying local: ${err}`);
      });
      
      // Also try local filesystem (for legacy documents)
      const filepath = join(UPLOAD_DIR, document.filename);
      await unlink(filepath).catch(() => {}); // Ignore if file doesn't exist
      
      // Delete from database
      await storage.deleteDocument(req.params.id);

      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  // Activities route
  app.get("/api/activities", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const activities = await storage.getActivitiesBySchool(schoolId);
      res.json(activities);
    } catch (error) {
      next(error);
    }
  });

  // Admin routes - Boards (requires beheer access)
  app.get("/api/boards", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      const boards = await storage.getAllBoards();
      res.json(boards);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/boards", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      const result = insertBoardSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const board = await storage.createBoard(result.data);
      res.json(board);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/boards/:id", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      const board = await storage.updateBoard(req.params.id, req.body);
      if (!board) return res.status(404).send("Board not found");
      res.json(board);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/boards/:id", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      await storage.deleteBoard(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/boards/:id/schools", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      const schools = await storage.getSchoolsByBoard(req.params.id);
      res.json(schools);
    } catch (error) {
      next(error);
    }
  });

  // Admin routes - Schools (requires beheer access)
  app.get("/api/schools", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      const schools = await storage.getAllSchools();
      res.json(schools);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/schools", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      const result = insertSchoolSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      // Create school in database
      const school = await storage.createSchool(result.data);

      // Create Supabase Storage bucket for the school
      const bucketName = getBucketName(school.id, school.name);
      try {
        await supabaseStorage.createBucketIfNotExists(bucketName);
        console.log(`Supabase bucket created for school: ${school.name}`);
      } catch (supabaseError) {
        console.error(`Failed to create Supabase bucket for ${school.name}:`, supabaseError);
        // Don't fail the request if bucket creation fails
        // The school is already created in the database
      }

      // Automatically associate the current user with the newly created school
      const user = await getUser(req);
      if (user) {
        try {
          // Get existing user-school associations
          const existingSchools = await storage.getUserSchools(user.id);
          
          // Check if user is already associated with this school (prevent duplicates)
          const alreadyAssociated = existingSchools.some(us => us.schoolId === school.id);
          
          if (!alreadyAssociated) {
            const isFirstSchool = existingSchools.length === 0;
            
            await storage.addUserSchool({
              userId: user.id,
              schoolId: school.id,
              isDefault: isFirstSchool, // Set as default if it's the user's first school
            });
            console.log(`User ${user.email} automatically associated with school: ${school.name}`);
          } else {
            console.log(`User ${user.email} already associated with school: ${school.name}`);
          }
        } catch (associationError) {
          console.error(`Failed to create user-school association for ${school.name}:`, associationError);
          // Don't fail the request if association creation fails
          // The school is already created in the database
        }
      }

      res.json(school);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/schools/:id", async (req, res, next) => {
    try {
      const school = await storage.getSchoolWithBoard(req.params.id);
      if (!school) return res.status(404).send("School not found");
      res.json(school);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/schools/:id", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      const school = await storage.updateSchool(req.params.id, req.body);
      if (!school) return res.status(404).send("Not found");
      res.json(school);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/schools/:id/photo", upload.single('photo'), async (req, res, next) => {
    try {
      if (!req.file) {
        return res.status(400).send("No photo file uploaded");
      }

      const schoolId = req.params.id;
      const school = await storage.getSchool(schoolId);
      if (!school) {
        return res.status(404).send("School not found");
      }

      const bucketName = getBucketName(schoolId, school.name);
      
      // Upload to Supabase Storage
      const fileName = `school-photo-${Date.now()}.${req.file.originalname.split('.').pop()}`;
      
      const photoUrl = await supabaseStorage.uploadFile(
        bucketName,
        'photos',
        fileName,
        req.file.buffer,
        req.file.mimetype
      );

      // Update school with photo URL
      const updatedSchool = await storage.updateSchool(schoolId, {
        schoolPhotoUrl: photoUrl
      });

      res.json(updatedSchool);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/schools/:id/photo", async (req, res, next) => {
    try {
      const schoolId = req.params.id;
      const school = await storage.getSchool(schoolId);
      
      if (!school) {
        return res.status(404).send("School not found");
      }

      // Extract file path from URL if photo exists
      if (school.schoolPhotoUrl) {
        try {
          // Parse the URL to extract file path
          const url = new URL(school.schoolPhotoUrl);
          const pathParts = url.pathname.split('/');
          // pathname format: /storage/v1/object/sign/bucket-name/module/filename
          // Or: /storage/v1/object/public/bucket-name/module/filename
          const bucketIndex = pathParts.findIndex(part => part.startsWith('school-'));
          if (bucketIndex !== -1 && pathParts.length > bucketIndex + 2) {
            const module = pathParts[bucketIndex + 1];
            const filename = pathParts.slice(bucketIndex + 2).join('/');
            const bucketName = getBucketName(schoolId, school.name);
            
            // Delete from Supabase Storage
            await supabaseStorage.deleteFile(
              bucketName,
              module,
              filename
            );
          }
        } catch (deleteError) {
          // Log but continue - we still want to clear the URL from database
          console.error('Error deleting file from Supabase:', deleteError);
        }
      }

      // Clear photo URL from database
      const updatedSchool = await storage.updateSchool(schoolId, {
        schoolPhotoUrl: null
      });

      res.json(updatedSchool);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/schools/:id", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      await storage.deleteSchool(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/users", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      next(error);
    }
  });

  // Manual user creation
  app.post("/api/users", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      const createUserSchema = z.object({
        email: z.string().email(),
        firstName: z.string().optional(),
        lastName: z.string().optional(),
        role: z.enum(["admin", "directeur", "medewerker"]),
        selectedSchoolIds: z.array(z.string()).optional().default([]),
        defaultSchoolId: z.string().optional(),
      });

      const result = createUserSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const { selectedSchoolIds, defaultSchoolId, ...userData } = result.data;

      // Create user with generated ID
      const userId = randomUUID();
      const user = await storage.createUser({
        ...userData,
        id: userId,
      } as InsertUser);

      // Add user-school relationships
      if (selectedSchoolIds.length > 0) {
        for (const schoolId of selectedSchoolIds) {
          await storage.addUserSchool({
            userId: user.id,
            schoolId,
            isDefault: schoolId === defaultSchoolId,
          } as InsertUserSchool);
        }
      }

      res.json(user);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/users/:id", isAuthenticated, requirePageAccess("beheer"), async (req, res, next) => {
    try {
      const updateSchema = z.object({
        role: z.enum(["admin", "directeur", "medewerker"]).optional(),
      });

      const result = updateSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const user = await storage.updateUser(req.params.id, result.data);
      if (!user) return res.status(404).send("User not found");
      
      res.json({ 
        id: user.id, 
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName, 
        role: user.role,
      });
    } catch (error) {
      next(error);
    }
  });

  // User Schools routes
  // Get all user-school relationships (for admin page)
  app.get("/api/user-schools/all", async (req, res, next) => {
    try {
      const allUserSchools = await storage.getAllUserSchools();
      res.json(allUserSchools);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/user-schools", async (req, res, next) => {
    try {
      const user = await getUser(req);
      if (!user) return res.status(401).send("Not authenticated");
      
      const schools = await storage.getAllSchoolsForUser(user.id);
      const activeSchoolId = await getActiveSchoolId(req);
      
      // Return schools with active school ID so frontend knows which one to select
      res.json({
        schools,
        activeSchoolId
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/user-schools", async (req, res, next) => {
    try {
      const result = insertUserSchoolSchema.safeParse(req.body);
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const userSchool = await storage.addUserSchool(result.data);
      res.json(userSchool);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/user-schools/:id", async (req, res, next) => {
    try {
      await storage.removeUserSchool(req.params.id);
      res.sendStatus(204);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/users/:id/active-school", async (req, res, next) => {
    try {
      const user = await getUser(req);
      const { schoolId } = req.body;
      
      if (!user) return res.status(401).send("Not authenticated");
      if (!schoolId) return res.status(400).send("School ID required");
      
      // Verify user has access to this school
      const userSchools = await storage.getAllSchoolsForUser(user.id);
      const hasAccess = userSchools.some(s => s.id === schoolId);
      
      if (!hasAccess) {
        return res.status(403).send("No access to this school");
      }
      
      // Set as default school (we don't use session anymore, always use default from DB)
      await storage.setDefaultSchool(user.id, schoolId);
      
      res.json({ success: true, activeSchoolId: schoolId });
    } catch (error) {
      next(error);
    }
  });

  // Dashboard statistics
  app.get("/api/dashboard/stats", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const [maintenance, appointments, contracts, reports] = await Promise.all([
        storage.getMaintenanceBySchool(schoolId),
        storage.getAppointmentsBySchool(schoolId),
        storage.getContractsBySchool(schoolId),
        storage.getReportsBySchool(schoolId),
      ]);

      const urgentMaintenance = maintenance.filter(m => m.priority === 'critical' || m.priority === 'high');
      const pendingReports = reports.filter(r => r.status === 'pending');
      const upcomingAppointments = appointments.filter(a => new Date(a.startDate) > new Date());

      res.json({
        urgentActions: urgentMaintenance.length,
        weeklyInspections: upcomingAppointments.length,
        openReports: pendingReports.length,
        totalMaintenance: maintenance.length,
        totalContracts: contracts.length,
      });
    } catch (error) {
      next(error);
    }
  });

  // Maintenance History routes
  app.get("/api/maintenance-history", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const startYear = req.query.startYear ? parseInt(req.query.startYear as string) : undefined;
      const endYear = req.query.endYear ? parseInt(req.query.endYear as string) : undefined;
      
      const history = await storage.getMaintenanceHistoryBySchool(schoolId, startYear, endYear);
      res.json(history);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/maintenance-history", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const result = insertMaintenanceHistorySchema.safeParse({
        ...req.body,
        schoolId,
      });

      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).message);
      }

      const history = await storage.createMaintenanceHistory(result.data);
      res.status(201).json(history);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/maintenance-history/:id", async (req, res, next) => {
    try {
      const result = insertMaintenanceHistorySchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).message);
      }

      const history = await storage.updateMaintenanceHistory(req.params.id, result.data);
      if (!history) return res.status(404).send("Maintenance history not found");
      res.json(history);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/maintenance-history/:id", async (req, res, next) => {
    try {
      await storage.deleteMaintenanceHistory(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Helper function to generate investment years for cyclic investments
  async function generateInvestmentYears(
    investmentId: string,
    startYear: number,
    cycleYears: number,
    amount: number
  ): Promise<void> {
    const maxYear = startYear + 30;
    const years: { year: number; amount: number }[] = [];

    for (let year = startYear; year <= maxYear; year += cycleYears) {
      years.push({ year, amount });
    }

    for (const { year, amount } of years) {
      await storage.createInvestmentYear({
        investmentId,
        year,
        amount,
      });
    }
  }

  // Investments routes
  app.get("/api/investments", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const startYear = req.query.startYear ? parseInt(req.query.startYear as string) : undefined;
      const endYear = req.query.endYear ? parseInt(req.query.endYear as string) : undefined;
      
      const investments = await storage.getInvestmentsBySchool(schoolId, startYear, endYear);
      
      // Fetch investment years for each investment
      const investmentsWithYears = await Promise.all(
        investments.map(async (investment) => {
          const years = await storage.getInvestmentYearsByInvestment(investment.id);
          // Filter years by range if specified
          const filteredYears = years.filter(year => {
            if (startYear !== undefined && year.year < startYear) return false;
            if (endYear !== undefined && year.year > endYear) return false;
            return true;
          });
          return {
            ...investment,
            years: filteredYears,
          };
        })
      );
      
      res.json(investmentsWithYears);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/investments", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const result = insertInvestmentSchema.safeParse({
        ...req.body,
        schoolId,
      });

      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).message);
      }

      const investment = await storage.createInvestment(result.data);

      // Generate investment years if provided
      const { yearAmounts } = req.body;
      if (yearAmounts && Array.isArray(yearAmounts)) {
        for (const { year, amount } of yearAmounts) {
          await storage.createInvestmentYear({
            investmentId: investment.id,
            year: parseInt(year),
            amount: parseInt(amount),
          });
        }
      } else if (result.data.isCyclic && result.data.cycleYears && result.data.startDate) {
        // Auto-generate years for cyclic investments
        const startYear = new Date(result.data.startDate).getFullYear();
        const amount = req.body.amount ? parseInt(req.body.amount) : 0;
        await generateInvestmentYears(investment.id, startYear, result.data.cycleYears, amount);
      } else if (result.data.startDate && req.body.amount) {
        // Auto-generate single year entry for normal investments
        const startYear = new Date(result.data.startDate).getFullYear();
        const amount = parseInt(req.body.amount);
        await storage.createInvestmentYear({
          investmentId: investment.id,
          year: startYear,
          amount: amount,
        });
      }

      res.status(201).json(investment);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/investments/:id", async (req, res, next) => {
    try {
      const result = insertInvestmentSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).message);
      }

      // Get current investment to check previous status
      const currentInvestment = await storage.getInvestmentById(req.params.id);
      if (!currentInvestment) return res.status(404).send("Investment not found");

      const investment = await storage.updateInvestment(req.params.id, result.data);
      if (!investment) return res.status(404).send("Investment not found");

      // Update investment years if needed
      const { yearAmounts } = req.body;
      if (yearAmounts && Array.isArray(yearAmounts)) {
        // Manual year amounts provided - replace all years
        await storage.deleteInvestmentYearsByInvestment(investment.id);
        for (const { year, amount } of yearAmounts) {
          await storage.createInvestmentYear({
            investmentId: investment.id,
            year: parseInt(year),
            amount: parseInt(amount),
          });
        }
      } else if (result.data.startDate !== undefined || req.body.amount !== undefined || result.data.isCyclic !== undefined || result.data.cycleYears !== undefined) {
        // Regenerate investment years based on updated values
        const newStartDate = result.data.startDate ?? currentInvestment.startDate;
        const newAmount = req.body.amount ? parseInt(req.body.amount) : 0;
        const newIsCyclic = result.data.isCyclic ?? currentInvestment.isCyclic;
        const newCycleYears = result.data.cycleYears ?? currentInvestment.cycleYears;

        if (newStartDate) {
          await storage.deleteInvestmentYearsByInvestment(investment.id);
          
          if (newIsCyclic && newCycleYears) {
            // Regenerate cyclic investment years
            const startYear = new Date(newStartDate).getFullYear();
            await generateInvestmentYears(investment.id, startYear, newCycleYears, newAmount);
          } else if (newAmount > 0) {
            // Regenerate single year entry for normal investments
            const startYear = new Date(newStartDate).getFullYear();
            await storage.createInvestmentYear({
              investmentId: investment.id,
              year: startYear,
              amount: newAmount,
            });
          }
        }
      }

      // Auto-create maintenanceHistory when status changes to "gereed"
      if (result.data.status === "gereed" && currentInvestment.status !== "gereed") {
        await storage.createMaintenanceHistory({
          title: investment.title,
          description: investment.description || undefined,
          category: investment.category || undefined,
          completedDate: investment.completedDate || new Date(),
          investmentId: investment.id,
          schoolId: investment.schoolId,
        });
      }

      res.json(investment);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/investments/:id", async (req, res, next) => {
    try {
      await storage.deleteInvestment(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Quotes routes
  app.get("/api/quotes", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const startYear = req.query.startYear ? parseInt(req.query.startYear as string) : undefined;
      const endYear = req.query.endYear ? parseInt(req.query.endYear as string) : undefined;
      
      const quotes = await storage.getQuotesBySchool(schoolId, startYear, endYear);
      res.json(quotes);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/quotes", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const result = insertQuoteSchema.safeParse({
        ...req.body,
        schoolId,
      });

      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).message);
      }

      // Log warning if quote is created without investment link
      if (!result.data.investmentId) {
        console.warn('[WARNING] Quote created without investmentId:', {
          vendor: result.data.vendor,
          quotedAmount: result.data.quotedAmount,
          schoolId: result.data.schoolId
        });
      }

      const quote = await storage.createQuote(result.data);
      res.status(201).json(quote);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/quotes/:id", async (req, res, next) => {
    try {
      const result = insertQuoteSchema.partial().safeParse(req.body);
      
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).message);
      }

      const quote = await storage.updateQuote(req.params.id, result.data);
      if (!quote) return res.status(404).send("Quote not found");
      res.json(quote);
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/quotes/:id", async (req, res, next) => {
    try {
      await storage.deleteQuote(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  // Analytics endpoints
  app.get("/api/analytics/available-years", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }
      
      // Get years from all relevant tables
      const result = await db.execute<AvailableYearsResult>(sql`
        SELECT DISTINCT year
        FROM (
          SELECT EXTRACT(YEAR FROM created_at)::int AS year FROM maintenance WHERE school_id = ${schoolId}
          UNION
          SELECT EXTRACT(YEAR FROM created_at)::int AS year FROM reports WHERE school_id = ${schoolId}
          UNION
          SELECT EXTRACT(YEAR FROM created_at)::int AS year FROM maintenance_history WHERE school_id = ${schoolId}
          UNION
          SELECT EXTRACT(YEAR FROM created_at)::int AS year FROM investments WHERE school_id = ${schoolId}
          UNION
          SELECT EXTRACT(YEAR FROM created_at)::int AS year FROM quotes WHERE school_id = ${schoolId}
        ) AS all_years
        WHERE year IS NOT NULL
        ORDER BY year
      `);
      
      const years = result.rows.map(row => Number(row.year));
      const currentYear = new Date().getFullYear();
      
      // Calculate min and max years with buffer
      // minYear: 5 years before the oldest record (or current year - 5 if no data)
      // maxYear: 5 years after current year for future planning
      const oldestYear = years.length > 0 ? Math.min(...years) : currentYear;
      const minYear = oldestYear - 5;
      const maxYear = currentYear + 5;
      
      res.json({ minYear, maxYear, years });
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/analytics/maintenance-by-month", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      const startYear = parseInt(req.query.startYear as string) || new Date().getFullYear();
      const endYear = parseInt(req.query.endYear as string) || startYear;
      
      const result = await db.execute<MaintenanceByMonthResult>(sql`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM maintenance
        WHERE 
          school_id = ${schoolId}
          AND EXTRACT(YEAR FROM created_at) >= ${startYear}
          AND EXTRACT(YEAR FROM created_at) <= ${endYear}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `);
      
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/analytics/reports-by-priority", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      const startYear = parseInt(req.query.startYear as string) || new Date().getFullYear();
      const endYear = parseInt(req.query.endYear as string) || startYear;
      
      const result = await db.execute<ReportsByPriorityResult>(sql`
        SELECT 
          priority,
          COUNT(*)::int AS count
        FROM reports
        WHERE 
          school_id = ${schoolId}
          AND EXTRACT(YEAR FROM created_at) >= ${startYear}
          AND EXTRACT(YEAR FROM created_at) <= ${endYear}
        GROUP BY priority
        ORDER BY count DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/analytics/maintenance-status", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      const startYear = parseInt(req.query.startYear as string) || new Date().getFullYear();
      const endYear = parseInt(req.query.endYear as string) || startYear;
      
      const result = await db.execute<MaintenanceStatusResult>(sql`
        SELECT 
          status,
          COUNT(*)::int AS count
        FROM maintenance
        WHERE 
          school_id = ${schoolId}
          AND EXTRACT(YEAR FROM created_at) >= ${startYear}
          AND EXTRACT(YEAR FROM created_at) <= ${endYear}
        GROUP BY status
        ORDER BY count DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/analytics/budget-overview", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }
      
      const startYear = parseInt(req.query.startYear as string) || new Date().getFullYear();
      const endYear = parseInt(req.query.endYear as string) || startYear;
      
      // Combine data from investments (budget) and maintenance_history (spent) per category
      const result = await db.execute<BudgetOverviewResult>(sql`
        WITH investment_budgets AS (
          SELECT 
            i.category,
            COALESCE(SUM(iy.amount), 0)::int AS budget
          FROM investments i
          LEFT JOIN investment_years iy ON i.id = iy.investment_id
          WHERE 
            i.school_id = ${schoolId}
            AND iy.year >= ${startYear}
            AND iy.year <= ${endYear}
          GROUP BY i.category
        ),
        maintenance_spent AS (
          SELECT 
            category,
            COALESCE(SUM(cost), 0)::int AS spent
          FROM maintenance_history
          WHERE 
            school_id = ${schoolId}
            AND EXTRACT(YEAR FROM completed_date) >= ${startYear}
            AND EXTRACT(YEAR FROM completed_date) <= ${endYear}
          GROUP BY category
        )
        SELECT 
          COALESCE(ib.category, ms.category) AS category,
          COALESCE(ib.budget, 0)::int AS budget,
          COALESCE(ms.spent, 0)::int AS spent,
          ROUND(CASE 
            WHEN COALESCE(ib.budget, 0) > 0 
            THEN (COALESCE(ms.spent, 0)::numeric / ib.budget * 100) 
            ELSE 0 
          END, 2) AS percentage
        FROM investment_budgets ib
        FULL OUTER JOIN maintenance_spent ms ON ib.category = ms.category
        WHERE COALESCE(ib.budget, 0) > 0 OR COALESCE(ms.spent, 0) > 0
        ORDER BY budget DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/analytics/investments-summary", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      const startYear = parseInt(req.query.startYear as string) || new Date().getFullYear();
      const endYear = parseInt(req.query.endYear as string) || startYear;
      
      const result = await db.execute<InvestmentsSummaryResult>(sql`
        SELECT 
          i.category,
          COALESCE(SUM(iy.amount), 0)::int AS total_budgeted
        FROM investments i
        LEFT JOIN investment_years iy ON i.id = iy.investment_id
        WHERE 
          i.school_id = ${schoolId}
          AND iy.year >= ${startYear}
          AND iy.year <= ${endYear}
        GROUP BY i.category
        ORDER BY total_budgeted DESC
      `);
      
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/analytics/investments-total", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      const startYear = parseInt(req.query.startYear as string) || new Date().getFullYear();
      const endYear = parseInt(req.query.endYear as string) || startYear;
      
      const result = await db.execute<InvestmentsTotalResult>(sql`
        SELECT 
          COALESCE(SUM(iy.amount), 0)::int AS total_budgeted,
          COUNT(DISTINCT i.id)::int AS total_count
        FROM investments i
        LEFT JOIN investment_years iy ON i.id = iy.investment_id
        WHERE 
          i.school_id = ${schoolId}
          AND iy.year >= ${startYear}
          AND iy.year <= ${endYear}
      `);
      
      res.json(result.rows[0]);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/analytics/reports-by-month", async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) {
        res.status(400).send("No school associated");
        return;
      }

      const startYear = parseInt(req.query.startYear as string) || new Date().getFullYear();
      const endYear = parseInt(req.query.endYear as string) || startYear;
      
      const result = await db.execute<ReportsByMonthResult>(sql`
        SELECT 
          TO_CHAR(DATE_TRUNC('month', created_at), 'YYYY-MM') AS month,
          COUNT(*)::int AS count
        FROM reports
        WHERE 
          school_id = ${schoolId}
          AND EXTRACT(YEAR FROM created_at) >= ${startYear}
          AND EXTRACT(YEAR FROM created_at) <= ${endYear}
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY DATE_TRUNC('month', created_at)
      `);
      
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/analytics/maintenance-history", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const startYear = parseInt(req.query.startYear as string) || new Date().getFullYear();
      const endYear = parseInt(req.query.endYear as string) || startYear;
      
      const result = await db.execute(sql`
        SELECT 
          COALESCE(category, 'Overig') AS category,
          COUNT(*)::int AS count,
          ROUND(COALESCE(SUM(cost), 0) / 100.0, 2) AS total_cost
        FROM maintenance_history
        WHERE 
          school_id = ${schoolId}
          AND EXTRACT(YEAR FROM completed_date) >= ${startYear}
          AND EXTRACT(YEAR FROM completed_date) <= ${endYear}
        GROUP BY category
        ORDER BY category
      `);
      
      res.json(result.rows);
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/analytics/financial-trends", isAuthenticated, requireSchoolAccess, async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const startYear = parseInt(req.query.startYear as string) || new Date().getFullYear();
      const endYear = parseInt(req.query.endYear as string) || startYear;
      
      // Get maintenance costs by year
      const maintenanceResult = await db.execute(sql`
        SELECT 
          EXTRACT(YEAR FROM completed_date)::int AS year,
          ROUND(COALESCE(SUM(cost), 0) / 100.0, 2) AS total_cost
        FROM maintenance_history
        WHERE 
          school_id = ${schoolId}
          AND EXTRACT(YEAR FROM completed_date) >= ${startYear}
          AND EXTRACT(YEAR FROM completed_date) <= ${endYear}
        GROUP BY EXTRACT(YEAR FROM completed_date)
        ORDER BY year
      `);
      
      // Get investments by year from investment_years table
      const investmentsResult = await db.execute(sql`
        SELECT 
          iy.year::int AS year,
          ROUND(COALESCE(SUM(iy.amount), 0) / 100.0, 2) AS total_budgeted
        FROM investments i
        LEFT JOIN investment_years iy ON i.id = iy.investment_id
        WHERE 
          i.school_id = ${schoolId}
          AND iy.year >= ${startYear}
          AND iy.year <= ${endYear}
        GROUP BY iy.year
        ORDER BY year
      `);
      
      // Create a complete year range and merge data
      const years = Array.from(
        { length: endYear - startYear + 1 }, 
        (_, i) => startYear + i
      );
      
      const maintenanceMap = new Map(
        maintenanceResult.rows.map((row: any) => [row.year, row.total_cost])
      );
      const investmentsMap = new Map(
        investmentsResult.rows.map((row: any) => [row.year, row.total_budgeted])
      );
      
      const trends = years.map(year => ({
        year,
        maintenance_cost: maintenanceMap.get(year) || 0,
        investments: investmentsMap.get(year) || 0
      }));
      
      res.json(trends);
    } catch (error) {
      next(error);
    }
  });

  // Year Plan Spreadsheet routes
  app.get("/api/year-plan/columns", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const columns = await storage.getYearPlanColumns(schoolId);
      res.json(columns);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/year-plan/columns", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const result = insertYearPlanColumnSchema.safeParse({ ...req.body, schoolId });
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const column = await storage.createYearPlanColumn(result.data);
      res.json(column);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/year-plan/columns/:id", async (req, res, next) => {
    try {
      const column = await storage.updateYearPlanColumn(req.params.id, req.body);
      res.json(column);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/year-plan/columns/:id/reorder", async (req, res, next) => {
    try {
      const { direction } = req.body;
      if (direction !== 'up' && direction !== 'down') {
        return res.status(400).send("Direction must be 'up' or 'down'");
      }
      await storage.reorderYearPlanColumn(req.params.id, direction);
      res.status(200).send();
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/year-plan/columns/:id", async (req, res, next) => {
    try {
      await storage.deleteYearPlanColumn(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  app.get("/api/year-plan/rows", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");
      
      const rows = await storage.getYearPlanRows(schoolId);
      res.json(rows);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/year-plan/rows", async (req, res, next) => {
    try {
      const schoolId = await getActiveSchoolId(req);
      if (!schoolId) return res.status(400).send("No school associated");

      const result = insertYearPlanRowSchema.safeParse({ ...req.body, schoolId });
      if (!result.success) {
        return res.status(400).send(fromZodError(result.error).toString());
      }

      const row = await storage.createYearPlanRow(result.data);
      res.json(row);
    } catch (error) {
      next(error);
    }
  });

  app.patch("/api/year-plan/rows/:id", async (req, res, next) => {
    try {
      const row = await storage.updateYearPlanRow(req.params.id, req.body);
      res.json(row);
    } catch (error) {
      next(error);
    }
  });

  app.post("/api/year-plan/rows/:id/reorder", async (req, res, next) => {
    try {
      const { direction } = req.body;
      if (direction !== 'up' && direction !== 'down') {
        return res.status(400).send("Direction must be 'up' or 'down'");
      }
      await storage.reorderYearPlanRow(req.params.id, direction);
      res.status(200).send();
    } catch (error) {
      next(error);
    }
  });

  app.delete("/api/year-plan/rows/:id", async (req, res, next) => {
    try {
      await storage.deleteYearPlanRow(req.params.id);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

import type { RequestHandler } from "express";
import bcrypt from "bcrypt";
import { storage } from "./storage";
import { hasAccess, type UserRole, type PageKey } from "@shared/permissions";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function comparePassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

import { getSupabaseUser } from "./supabase-auth";

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Try Supabase Auth first
  const supabaseUser = await getSupabaseUser(req);
  if (supabaseUser) {
    (req as any).userId = supabaseUser.id;
    return next();
  }
  
  // Fallback to session-based auth
  if (!req.session?.userId) {
    return res.status(401).json({ message: "Unauthorized", needsLogin: true });
  }
  next();
};

export const requireSchoolAccess: RequestHandler = async (req, res, next) => {
  // Get user ID from Supabase or session
  const userId = (req as any).userId || req.session?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized", needsLogin: true });
  }
  
  try {
    const schools = await storage.getAllSchoolsForUser(userId);
    if (schools.length === 0) {
      return res.status(403).json({ message: "No school access", needsSchoolAssignment: true });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export const requireAdmin: RequestHandler = async (req, res, next) => {
  // Get user ID from Supabase or session
  const userId = (req as any).userId || req.session?.userId;
  
  if (!userId) {
    return res.status(401).json({ message: "Unauthorized", needsLogin: true });
  }
  
  try {
    const user = await storage.getUser(userId);
    if (!user || user.role !== "admin") {
      return res.status(403).json({ message: "Forbidden - Admin access required" });
    }
    next();
  } catch (error) {
    return res.status(500).json({ message: "Server error" });
  }
};

export function requireRole(...allowedRoles: UserRole[]): RequestHandler {
  return async (req, res, next) => {
    const userId = (req as any).userId || req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized", needsLogin: true });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user || !allowedRoles.includes(user.role as UserRole)) {
        return res.status(403).json({ message: "Forbidden - Insufficient permissions" });
      }
      next();
    } catch (error) {
      return res.status(500).json({ message: "Server error" });
    }
  };
}

export function requirePageAccess(pageKey: PageKey): RequestHandler {
  return async (req, res, next) => {
    const userId = (req as any).userId || req.session?.userId;
    
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized", needsLogin: true });
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user || !hasAccess(user.role as UserRole, pageKey)) {
        return res.status(403).json({ message: "Forbidden - No access to this resource" });
      }
      next();
    } catch (error) {
      return res.status(500).json({ message: "Server error" });
    }
  };
}

declare module "express-session" {
  interface SessionData {
    userId: string;
  }
}

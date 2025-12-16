import { createClient, SupabaseClient } from "@supabase/supabase-js";
import type { Request, Response, NextFunction } from "express";
import { storage } from "./storage";

// Lazy initialization of Supabase admin client
let _supabaseAdmin: SupabaseClient | null = null;
let _supabaseInitialized = false;

function getSupabaseAdmin(): SupabaseClient | null {
  if (_supabaseInitialized) return _supabaseAdmin;
  
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  _supabaseInitialized = true;
  
  if (!supabaseUrl || !supabaseServiceKey) {
    console.warn("⚠️  Supabase credentials not configured - Supabase Auth disabled");
    return null;
  }
  
  _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  
  console.log("✅ Supabase Auth client initialized");
  return _supabaseAdmin;
}

/**
 * Verify Supabase JWT token and get user
 */
export async function verifySupabaseToken(token: string) {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) return null;
  
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    
    if (error || !user) {
      return null;
    }
    
    return user;
  } catch (error) {
    console.error("[SupabaseAuth] Error verifying token:", error);
    return null;
  }
}

/**
 * Extract token from Authorization header or cookie
 */
export function extractToken(req: Request): string | null {
  // Check Authorization header first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authHeader.substring(7);
  }
  
  // Check for Supabase session cookie (format: sb-<project-ref>-auth-token)
  const cookieName = `sb-${process.env.SUPABASE_URL?.split("//")[1]?.split(".")[0]}-auth-token`;
  if (req.cookies?.[cookieName]) {
    try {
      const session = JSON.parse(req.cookies[cookieName]);
      return session?.access_token || null;
    } catch {
      return null;
    }
  }
  
  return null;
}

/**
 * Middleware to verify Supabase authentication
 * This replaces the session-based authentication
 */
export async function verifySupabaseAuth(req: Request, res: Response, next: NextFunction) {
  const token = extractToken(req);
  
  if (!token) {
    return res.status(401).json({ message: "Unauthorized", needsLogin: true });
  }
  
  const user = await verifySupabaseToken(token);
  
  if (!user) {
    return res.status(401).json({ message: "Unauthorized", needsLogin: true });
  }
  
  // Store user ID in request for use in routes
  (req as any).supabaseUserId = user.id;
  (req as any).supabaseUser = user;
  
  next();
}

/**
 * Get user from Supabase and sync with local database
 */
export async function getSupabaseUser(req: Request) {
  const token = extractToken(req);
  
  if (!token) {
    return null;
  }
  
  const supabaseUser = await verifySupabaseToken(token);
  
  if (!supabaseUser) {
    return null;
  }
  
  // Get or create user in local database
  let localUser = await storage.getUserByEmail(supabaseUser.email || "");
  
  if (!localUser) {
    // Create user in local database if doesn't exist
    localUser = await storage.upsertUser({
      id: supabaseUser.id,
      email: supabaseUser.email || "",
      firstName: supabaseUser.user_metadata?.first_name || null,
      lastName: supabaseUser.user_metadata?.last_name || null,
      role: "medewerker",
    });
  }
  // Note: We don't update the user ID if it differs - the local database ID takes precedence
  // to avoid breaking foreign key constraints (documents, user_schools, etc.)
  
  return localUser;
}

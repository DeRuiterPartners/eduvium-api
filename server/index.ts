import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { runMigrations } from "./migrations";
import { sessionMiddleware, assertDatabaseConfig, dbHealthHandler } from "./db";

// Optional Vite utilities (only in dev)
let setupVite: any = null;
let serveStatic: any = null;
let log: (msg: string, src?: string) => void;

try {
  const viteModule = await import("./vite");
  setupVite = viteModule.setupVite;
  serveStatic = viteModule.serveStatic;
  log = viteModule.log;
} catch {
  console.warn("⚠️  Vite not available, using fallback logger");
  log = (message: string, source = "express") => {
    const t = new Date().toLocaleTimeString("en-US", { hour12: true });
    console.log(`${t} [${source}] ${message}`);
  };
}

const app = express();

// Log database configuration
assertDatabaseConfig();

// CORS configuration - allow landing page, frontend, and Replit dev domains
const allowedOrigins = [
  "http://localhost:5000",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://eduvium.nl",
  "https://www.eduvium.nl",
  "https://landingspagina.replit.app",
  process.env.FRONTEND_URL || "",
  process.env.APP_URL || "",
].filter(Boolean);

// Also allow Replit development domains dynamically
const isReplitDomain = (origin: string | undefined): boolean => {
  if (!origin) return false;
  return origin.includes('.replit.dev') || origin.includes('.replit.app');
};

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || isReplitDomain(origin)) {
      callback(null, true);
    } else {
      console.warn(`CORS blocked origin: ${origin}`);
      callback(null, false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// Middleware
app.set("trust proxy", 1);
// Use safe session middleware that handles connection errors gracefully
app.use((req, res, next) => {
  sessionMiddleware(req, res, (err) => {
    if (err) {
      // Handle various connection errors gracefully
      const isConnectionError = 
        err.code === 'ECONNRESET' || 
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED' ||
        err.message?.includes('timeout') ||
        err.message?.includes('terminated') ||
        err.code === 'XX000'; // PostgreSQL internal error
      
      if (isConnectionError) {
        console.warn('⚠️  Session store error (non-fatal), continuing without session persistence...');
        // Continue without session - Supabase Auth handles authentication
        return next();
      }
    }
    next(err);
  });
});
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// DB health endpoint
app.get("/health/db", dbHealthHandler);

// Logging middleware for API routes
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let captured: any;

  const originalJson = res.json;
  res.json = function (body, ...args) {
    captured = body;
    return originalJson.apply(res, [body, ...args]);
  };

  res.on("finish", () => {
    if (path.startsWith("/api")) {
      let line = `${req.method} ${path} ${res.statusCode} in ${Date.now() - start}ms`;

      if (captured) line += ` :: ${JSON.stringify(captured)}`;
      if (line.length > 120) line = line.substring(0, 119) + "…";

      log(line);
    }
  });

  next();
});

(async () => {
  log("Running database migrations...");
  await runMigrations();

  // Register API routes — IMPORTANT: must NOT return or start its own server
  await registerRoutes(app);

  // Global error handler (never crash the server)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) {
      const status = err.status || err.statusCode || 500;
      res.status(status).json({ message: err.message || "Internal server error" });
    }
    console.error("Unhandled error:", err);
  });

  // Vite in development ONLY
  if (app.get("env") === "development") {
    if (setupVite) {
      await setupVite(app);
    } else {
      log("⚠️  Dev mode without Vite: frontend disabled");
    }
  } else {
    // Production static file serving for built frontend
    if (serveStatic) {
      serveStatic(app);
    } else {
      log("⚠️  No static serving function found");
    }
  }

  // Azure uses PORT env var (required)
  const port = Number(process.env.PORT) || 5000;

  app.listen(port, "0.0.0.0", () => {
    log(`Server running on port ${port}`);
  });
})();





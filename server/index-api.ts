import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import cors from "cors";
import { registerRoutes } from "./routes";
import { runMigrations } from "./migrations";
import { sessionMiddleware, assertDatabaseConfig, dbHealthHandler } from "./db";

const app = express();

const log = (message: string, source = "api") => {
  const t = new Date().toLocaleTimeString("en-US", { hour12: true });
  console.log(`${t} [${source}] ${message}`);
};

assertDatabaseConfig();

const allowedOrigins = [
  "http://localhost:5000",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://eduvium.nl",
  "https://www.eduvium.nl",
  process.env.FRONTEND_URL || "",
  process.env.APP_URL || "",
].filter(Boolean);

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

app.set("trust proxy", 1);

app.use((req, res, next) => {
  sessionMiddleware(req, res, (err) => {
    if (err) {
      const isConnectionError = 
        err.code === 'ECONNRESET' || 
        err.code === 'ETIMEDOUT' ||
        err.code === 'ECONNREFUSED' ||
        err.message?.includes('timeout') ||
        err.message?.includes('terminated') ||
        err.code === 'XX000';
      
      if (isConnectionError) {
        console.warn('⚠️  Session store error (non-fatal), continuing without session persistence...');
        return next();
      }
    }
    next(err);
  });
});

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.get("/health/db", dbHealthHandler);

app.get("/health", (_req: Request, res: Response) => {
  res.status(200).json({ 
    status: "ok", 
    service: "eduvium-api",
    timestamp: new Date().toISOString() 
  });
});

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
    if (path.startsWith("/api") || path.startsWith("/health")) {
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

  await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    if (!res.headersSent) {
      const status = err.status || err.statusCode || 500;
      res.status(status).json({ message: err.message || "Internal server error" });
    }
    console.error("Unhandled error:", err);
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).json({ message: "Not found" });
  });

  const port = Number(process.env.PORT) || 5000;

  app.listen(port, "0.0.0.0", () => {
    log(`API server running on port ${port}`);
    log(`Allowed CORS origins: ${allowedOrigins.join(", ")}`);
  });
})();

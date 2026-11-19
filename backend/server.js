const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const path = require("path");
const fs = require("fs");

const fetchZohoJobs = require("./services/fetchZohoJobs");
const fetchMicrosoftJobs = require("./services/fetchMicrosoftJobs");
const monitoringRoutes = require("./routes/monitoring");
const healthMonitor = require("./services/healthMonitor");

const app = express();

// 1. Security middleware: Helmet with Content Security Policy
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https://t3.gstatic.com"],
        connectSrc: ["'self'", "http://localhost:5000", "http://localhost:5173"]
      }
    },
    crossOriginEmbedderPolicy: false
  })
);

// 2. CORS and request configuration
const allowedOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((o) => o.trim())
  : ["http://localhost:5173", "http://localhost:3000", "http://localhost:5000"];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps, curl, or same-origin)
      if (!origin || allowedOrigins.includes(origin) || process.env.NODE_ENV !== "production") {
        callback(null, true);
      } else {
        callback(new Error("CORS policy violation: Origin not allowed"));
      }
    },
    methods: ["GET", "HEAD", "OPTIONS"],
    credentials: true
  })
);

app.use(express.json({ limit: "10kb" }));

// 3. Rate limiting on API routes
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // max 200 requests per window per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests from this IP, please try again later." }
});

app.use("/api/", apiLimiter);

// 4. API routes
// Career portal health monitoring endpoint
app.use("/api/monitoring", monitoringRoutes);

// Preserved existing job aggregation endpoint
app.get("/jobs", async (req, res, next) => {
  try {
    const zohoJobs = await fetchZohoJobs();
    const microsoftJobs = await fetchMicrosoftJobs();

    const allJobs = [
      ...zohoJobs,
      ...microsoftJobs,
    ];

    res.json(allJobs);
  } catch (error) {
    next(error);
  }
});

// Unknown API routes return proper JSON 404 instead of HTML
app.use((req, res, next) => {
  if (req.path.startsWith("/api") || req.path.startsWith("/jobs")) {
    return res.status(404).json({ error: "API endpoint not found" });
  }
  next();
});

// 5. Static frontend serving
const frontendDistPath = path.join(__dirname, "../frontend/dist");
const frontendIndexPath = path.join(frontendDistPath, "index.html");

if (fs.existsSync(frontendDistPath)) {
  app.use(express.static(frontendDistPath));
}

// 6. React SPA fallback (Express 5 compatible middleware without outdated wildcard strings)
app.use((req, res, next) => {
  if (req.method === "GET" && fs.existsSync(frontendIndexPath)) {
    return res.sendFile(frontendIndexPath);
  }
  next();
});

// 7. Generic 404 handler if frontend build is missing or for unhandled routes
app.use((req, res) => {
  res.status(404).json({ error: "Not Found" });
});

// 8. Centralized Error Handler (prevents leaking internal stack traces in production)
app.use((err, req, res, _next) => { // eslint-disable-line no-unused-vars
  console.error("[ServerError]", err.message);
  const statusCode = err.status || 500;
  res.status(statusCode).json({
    error: process.env.NODE_ENV === "production" ? "Internal Server Error" : err.message
  });
});

const PORT = process.env.PORT || 5000;

let server = null;
if (process.env.NODE_ENV !== "test") {
  server = app.listen(PORT, () => {
    console.log(`Ascend Server running on port ${PORT} [${process.env.NODE_ENV || "development"}]`);
    // Start the automated 60-minute health monitoring service
    healthMonitor.startScheduler(true);
  });
}

module.exports = app;

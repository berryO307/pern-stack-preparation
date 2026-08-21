import AgentAPI from "apminsight";
AgentAPI.config()

import express from "express";
import subjectsRouter from "./routes/subjects.js";
import usersRouter from "./routes/users.js";
import classesRouter from "./routes/classes.js";
import departmentsRouter from "./routes/departments.js";
import enrollmentsRouter from "./routes/enrollments.js";
import dashboardRouter from "./routes/dashboard.js";
import workspaceRouter from "./routes/workspace.js";
import cors from "cors";
import securityMiddleware from "./middleware/security.js";
import authRateLimit from "./middleware/authRateLimit.js";
import sessionMiddleware from "./middleware/session.js";
import {toNodeHandler} from "better-auth/node";
import {auth} from "./lib/auth.js";

const app = express();
// Railway (and most PaaS hosts) assign the listening port dynamically via
// this env var and route external traffic to whatever the app actually
// binds - hardcoding 8000 would silently break in production.
const PORT = process.env.PORT ? Number(process.env.PORT) : 8000;

if (!process.env.FRONTEND_URL) {
  throw new Error("Frontend URL is missing");
}

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}))

// Both middlewares only read headers/cookies, so they're safe to run before the
// better-auth handler below, which needs the raw (unconsumed-by-express.json) body.
// This also means sign-in/sign-up/guest-creation - the endpoints most worth rate
// limiting - are actually covered instead of bypassing security entirely.
app.use(sessionMiddleware);
app.use(securityMiddleware);

app.all('/api/auth/*splat', authRateLimit, toNodeHandler(auth));

app.use(express.json());

app.use('/api/subjects', subjectsRouter)
app.use('/api/users', usersRouter)
app.use('/api/classes', classesRouter)
app.use('/api/departments', departmentsRouter)
app.use('/api/enrollments', enrollmentsRouter)
app.use('/api/dashboard', dashboardRouter)
app.use('/api/demo', workspaceRouter)

app.get("/", (_req, res) => {
  res.send("Classroom backend is up and running!");
});

// Bind explicitly to 0.0.0.0 - Railway's proxy couldn't reach the app even
// though it reported "listening" fine, which is the classic symptom of a
// container only accepting connections on a loopback-scoped default rather
// than every interface.
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server listening on port ${PORT}`);
});
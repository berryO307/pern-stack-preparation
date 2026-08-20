import AgentAPI from "apminsight";
AgentAPI.config()

import express from "express";
import subjectsRouter from "./routes/subjects.js";
import usersRouter from "./routes/users.js";
import classesRouter from "./routes/classes.js";
import departmentsRouter from "./routes/departments.js";
import cors from "cors";
import securityMiddleware from "./middleware/security.js";
import {toNodeHandler} from "better-auth/node";
import {auth} from "./lib/auth.js";

const app = express();
const PORT = 8000;

if (!process.env.FRONTEND_URL) {
  throw new Error("Frontend URL is missing");
}

app.use(cors({
  origin: process.env.FRONTEND_URL,
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}))

app.all('/api/auth/*splat', toNodeHandler(auth));

app.use(express.json());

app.use(securityMiddleware);

app.use('/api/subjects', subjectsRouter)
app.use('/api/users', usersRouter)
app.use('/api/classes', classesRouter)
app.use('/api/departments', departmentsRouter)

app.get("/", (_req, res) => {
  res.send("Classroom backend is up and running!");
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
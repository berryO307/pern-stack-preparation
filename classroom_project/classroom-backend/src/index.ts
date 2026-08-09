import express from "express";
import subjectsRouter from "./routes/subjects";
import cors from "cors";

const app = express();
const PORT = 8000;

if (process.env.FRONTEND_URL) {
  throw new Error("Frontend URL is missing");
}

app.use(cors({
  origin: process.env.FRONTEND_URL,
  method: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}))

app.use(express.json());
app.use('/api/subjects', subjectsRouter)

app.get("/", (_req, res) => {
  res.send("Classroom backend is up and running!");
});

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
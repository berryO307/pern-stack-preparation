import express from "express";
import { eq } from "drizzle-orm"; // Required for SQL filtering (WHERE clauses)
import { db } from "./db.js"; // Import your Drizzle database connection
import { cars } from "./schema.js"; // Import your Drizzle schema

const app = express();
const port = 3000;
const router = express.Router();

// Middleware to parse incoming JSON bodies
app.use(express.json());

// Logging Middleware
app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    next();
});

// GET all cars
router.get("/", async (req, res) => {
    try {
        const allCars = await db.select().from(cars);
        res.json(allCars);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch cars" });
    }
});

// GET a specific car by ID
router.get("/:id", async (req, res) => {
    try {
        const carId = parseInt(req.params.id);
        
        // Select where the DB id matches the parameter id
        const [car] = await db.select().from(cars).where(eq(cars.id, carId));
        
        if (!car) {
            return res.status(404).json({ error: "Car not found" });
        }
        res.json(car);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch car" });
    }
});

// POST a new car
router.post("/", async (req, res) => {
    try {
        const { make, model, year, price } = req.body;
        
        if (!make || !model || !year || !price) {
            return res.status(400).json({ error: "Make, model, year, and price are required" });
        }

        const [newCar] = await db.insert(cars).values({ make, model, year, price }).returning();
        res.status(201).json(newCar);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Failed to create car" });
    }
});

// PUT (Update) an existing car
router.put("/:id", async (req, res) => {
    try {
        const carId = parseInt(req.params.id);
        const { make, model, year, price } = req.body;

        if (!make || !model || !year || !price) {
            return res.status(400).json({ error: "Make, model, year, and price are required" });
        }

        const [updatedCar] = await db
            .update(cars)
            .set({ make, model, year, price })
            .where(eq(cars.id, carId))
            .returning();

        if (!updatedCar) {
            return res.status(404).json({ error: "Car not found" });
        }
        res.json(updatedCar);
    } catch (error) {
        res.status(500).json({ error: "Failed to update car" });
    }
});

// DELETE a car
router.delete("/:id", async (req, res) => {
    try {
        const carId = parseInt(req.params.id);
        
        const [deletedCar] = await db
            .delete(cars)
            .where(eq(cars.id, carId))
            .returning();

        if (!deletedCar) {
            return res.status(404).json({ error: "Car not found" });
        }
        res.json(deletedCar);
    } catch (error) {
        res.status(500).json({ error: "Failed to delete car" });
    }
});

app.use("/api/v1/cars", router);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
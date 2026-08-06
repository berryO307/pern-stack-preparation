import express from "express";

const app = express();
const port = 3000;

const router = express.Router();

let cars = [
    { id: 1, make: "Toyota", model: "Camry", year: 2020 },
    { id: 2, make: "Honda", model: "Civic", year: 2019 },
    { id: 3, make: "Ford", model: "Mustang", year: 2021 },
];

app.use(express.json());

app.use((req, res, next) => {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] ${req.method} ${req.originalUrl}`);
    next();
});

router.get("/", (req, res) => {
    res.json(cars);
});

router.get("/:id", (req, res) => {
    const carId = req.params.id;
    const car = cars.find((c) => c.id === parseInt(carId));
    if (!car) {
        return res.status(404).json({ error: "Car not found" });
    }
    res.json(car);
});

router.get("/", (req, res) => {
    res.send("List of cars will be displayed here.");
});

router.post("/", (req, res) => {
    const { make, model, year } = req.body;
    
    if (!make || !model || !year) {
        return res.status(400).json({ error: "Make, model, and year are required" });
    }

    const newCar = {
        id: cars.length + 1,
        make,
        model,
        year,
    };
    cars.push(newCar);
    res.status(201).json(newCar);
});

router.put("/:id", (req, res) => {
    const carId = req.params.id;
    const index = cars.findIndex((c) => c.id === parseInt(carId));
    if (index === -1) {
        return res.status(404).json({ error: "Car not found" });
    }
    const { make, model, year, price } = req.body;
    if (!make || !model || !year || !price) {
        return res.status(400).json({ error: "Make, model, year, and price are required" });
    }
    cars[index] = { ...cars[index], make, model, year, price };
    res.json(cars[index]);
});

router.delete("/:id", (req, res) => {
    const carId = req.params.id;
    const index = cars.findIndex((c) => c.id === parseInt(carId));
    if (index === -1) {
        return res.status(404).json({ error: "Car not found" });
    }

    const deletedCar = cars.splice(index, 1);
    res.json(deletedCar[0]);
});

app.use("/api/v1/cars", router);

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
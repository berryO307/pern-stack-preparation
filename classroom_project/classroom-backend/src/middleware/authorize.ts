import type { Request, Response, NextFunction } from "express";

export const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Sign in required" });
    next();
};

export const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ error: "Sign in required" });
    if (req.user.role !== "admin") return res.status(403).json({ error: "Admins only" });
    next();
};

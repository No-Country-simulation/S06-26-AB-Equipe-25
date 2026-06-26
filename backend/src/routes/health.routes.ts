import { Router } from "express";

export const healthRoutes = Router();

healthRoutes.get("/", (req, res) => {
  return res.json({
    status: "ok"
  });
});
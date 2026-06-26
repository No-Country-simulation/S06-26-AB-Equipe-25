import { Router } from "express";

export const matchRoutes = Router();

matchRoutes.post("/", (req, res) => {
  return res.json({
    message: "Match endpoint funcionando",
    receivedBody: req.body
  });
});
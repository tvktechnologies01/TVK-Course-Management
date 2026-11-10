import { Router } from "express";
import { whatsappWebhookController } from "../controllers/whatsapp-webhook.controller";

export const whatsappWebhookRouter = Router();

// Meta verification handshake (GET)
whatsappWebhookRouter.get("/webhook", (req, res) => whatsappWebhookController.verifyWebhook(req, res));

// Meta incoming event notifications (POST)
whatsappWebhookRouter.post("/webhook", (req, res) => whatsappWebhookController.handleWebhook(req, res));

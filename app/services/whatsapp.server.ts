import { prisma } from "./database.server";
import Twilio from "twilio";

// ========================================
// Twilio WhatsApp Configuration
// ========================================

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886";

let twilioClient: ReturnType<typeof Twilio> | null = null;

function getTwilioClient() {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
    console.warn("[WhatsApp] Twilio credentials not configured.");
    return null;
  }
  if (!twilioClient) {
    twilioClient = Twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN);
  }
  return twilioClient;
}

/**
 * Format phone number for WhatsApp (expects whatsapp:+856XXXXXXXXXX format)
 */
function formatPhoneForWhatsApp(phone: string | number | null): string | null {
  if (!phone) return null;

  let formattedPhone = phone.toString();
  formattedPhone = formattedPhone.replace(/^whatsapp:\+?/, "");

  if (formattedPhone.startsWith("856")) {
    formattedPhone = formattedPhone.substring(3);
  }

  formattedPhone = formattedPhone.replace(/^0+/, "");

  if (!formattedPhone.match(/^(20|30)\d{8}$/)) {
    console.warn(`[WhatsApp] Invalid phone number format: ${formattedPhone}`);
    return null;
  }

  return `whatsapp:+856${formattedPhone}`;
}

/**
 * Send WhatsApp message via Twilio
 */
export async function sendWhatsApp(
  phone: string | number | null,
  message: string
): Promise<boolean> {
  try {
    const client = getTwilioClient();
    if (!client) return false;

    const to = formatPhoneForWhatsApp(phone);
    if (!to) return false;

    await client.messages.create({
      from: TWILIO_WHATSAPP_FROM,
      to,
      body: message,
    });

    console.log(`[WhatsApp] Message sent to ${to}`);
    return true;
  } catch (error) {
    console.error("[WhatsApp] SEND_FAILED", error);
    return false;
  }
}

/**
 * Send WhatsApp message to model (checks preference)
 */
export async function sendWhatsAppToModel(
  modelId: string,
  message: string
): Promise<void> {
  try {
    const model = await prisma.model.findUnique({
      where: { id: modelId },
      select: { whatsapp: true, sendWhatsappNoti: true },
    });

    if (!model?.sendWhatsappNoti) return;

    if (model.whatsapp) {
      sendWhatsApp(model.whatsapp, message).catch((err) =>
        console.error("[WhatsApp] Failed to send to model:", err)
      );
    }
  } catch (error) {
    console.error("[WhatsApp] getModelInfo failed:", error);
  }
}

/**
 * Send WhatsApp message to customer (checks preference)
 */
export async function sendWhatsAppToCustomer(
  customerId: string,
  message: string
): Promise<void> {
  try {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { whatsapp: true, sendWhatsappNoti: true },
    });

    if (!customer?.sendWhatsappNoti) return;

    if (customer.whatsapp) {
      sendWhatsApp(customer.whatsapp, message).catch((err) =>
        console.error("[WhatsApp] Failed to send to customer:", err)
      );
    }
  } catch (error) {
    console.error("[WhatsApp] getCustomerInfo failed:", error);
  }
}

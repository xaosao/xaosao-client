import nodemailer from "nodemailer";
import Telbiz from "telbiz";

// Admin email and phone for notifications
const ADMIN_EMAIL = "xaosao95@gmail.com";
const ADMIN_PHONE = "2012345678";

// Initialize Telbiz SMS client
const tb = new Telbiz(
  process.env.TELBIZ_CLIENT_ID as string,
  process.env.TELBIZ_SECRETKEY as string
);

// Create transporter - using Gmail SMTP
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "", // Use App Password for Gmail
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

async function sendEmail(options: EmailOptions): Promise<boolean> {
  try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.warn("SMTP credentials not configured. Email not sent.");
      return false;
    }

    await transporter.sendMail({
      from: `"XaoSao System" <${process.env.SMTP_USER}>`,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    console.log(`Email sent to ${options.to}: ${options.subject}`);
    return true;
  } catch (error) {
    console.error("SEND_EMAIL_FAILED", error);
    return false;
  }
}

async function sendAdminSMS(message: string): Promise<boolean> {
  try {
    if (!process.env.TELBIZ_CLIENT_ID || !process.env.TELBIZ_SECRETKEY) {
      console.warn("Telbiz credentials not configured. SMS not sent.");
      return false;
    }

    await tb.SendSMSAsync("OTP", ADMIN_PHONE, message);
    console.log(`Admin SMS sent to ${ADMIN_PHONE}`);
    return true;
  } catch (error) {
    console.error("SEND_ADMIN_SMS_FAILED", error);
    return false;
  }
}

// ========================================
// Notify Admin: New Pending Model
// ========================================

interface NewModelData {
  id: string;
  firstName: string;
  lastName?: string | null;
  email?: string;
  tel?: number;
}

export async function notifyAdminNewPendingModel(
  model: NewModelData
): Promise<void> {
  const subject = `[XaoSao] New Model Registration - ${model.firstName} ${model.lastName || ""}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #ec4899 0%, #f43f5e 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
        .label { font-weight: bold; color: #6b7280; }
        .value { color: #111827; }
        .button { display: inline-block; background: #ec4899; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">New Model Registration</h2>
          <p style="margin: 5px 0 0;">A new model is waiting for approval</p>
        </div>
        <div class="content">
          <div class="info-row">
            <span class="label">Name:</span>
            <span class="value">${model.firstName} ${model.lastName || ""}</span>
          </div>
          ${
            model.email
              ? `
          <div class="info-row">
            <span class="label">Email:</span>
            <span class="value">${model.email}</span>
          </div>
          `
              : ""
          }
          ${
            model.tel
              ? `
          <div class="info-row">
            <span class="label">Phone:</span>
            <span class="value">${model.tel}</span>
          </div>
          `
              : ""
          }
          <div class="info-row">
            <span class="label">Registered At:</span>
            <span class="value">${new Date().toLocaleString()}</span>
          </div>

          <a href="${process.env.ADMIN_URL || "https://admin.xaosao.la"}/dashboard/models/approval/${model.id}" class="button">
            Review Application
          </a>
        </div>
        <div class="footer">
          <p>This is an automated notification from XaoSao System.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send email without awaiting to not block the registration flow
  sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
  }).catch((err) =>
    console.error("Failed to send new model notification:", err)
  );

  // Send SMS to admin
  const smsMessage = `XaoSao: ມີ Model ໃໝ່ລົງທະບຽນ - ${model.firstName} ${model.lastName || ""}. ກະລຸນາກວດສອບ.`;
  sendAdminSMS(smsMessage).catch((err) =>
    console.error("Failed to send new model SMS notification:", err)
  );
}

// ========================================
// Notify Admin: New Withdrawal Request
// ========================================

interface WithdrawalData {
  id: string;
  amount: number;
  bankAccount: string;
  modelName: string;
}

export async function notifyAdminNewWithdrawal(
  data: WithdrawalData
): Promise<void> {
  console.log("Sending withdrawal notification email to admin...");
  const subject = `[XaoSao] New Withdrawal Request - ${data.amount.toLocaleString()} LAK`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #f59e0b 0%, #ea580c 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
        .label { font-weight: bold; color: #6b7280; }
        .value { color: #111827; }
        .amount { font-size: 24px; font-weight: bold; color: #059669; }
        .button { display: inline-block; background: #f59e0b; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">New Withdrawal Request</h2>
          <p style="margin: 5px 0 0;">A model has requested a withdrawal</p>
        </div>
        <div class="content">
          <div class="info-row">
            <span class="label">Amount:</span>
            <span class="amount">${data.amount.toLocaleString()} LAK</span>
          </div>
          <div class="info-row">
            <span class="label">Model:</span>
            <span class="value">${data.modelName}</span>
          </div>
          <div class="info-row">
            <span class="label">Bank Account:</span>
            <span class="value">${data.bankAccount}</span>
          </div>
          <div class="info-row">
            <span class="label">Requested At:</span>
            <span class="value">${new Date().toLocaleString()}</span>
          </div>

          <a href="${process.env.ADMIN_URL || "https://admin.xaosao.la"}/dashboard/transactions" class="button">
            Review Transaction
          </a>
        </div>
        <div class="footer">
          <p>This is an automated notification from XaoSao System.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send email without awaiting to not block the withdrawal flow
  sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
  }).catch((err) =>
    console.error("Failed to send withdrawal notification:", err)
  );

  // Send SMS to admin
  const smsMessage = `XaoSao: ມີຄຳຮ້ອງຖອນເງິນໃໝ່ - ${data.amount.toLocaleString()} LAK ຈາກ ${data.modelName}. ກະລຸນາກວດສອບ.`;
  sendAdminSMS(smsMessage).catch((err) =>
    console.error("Failed to send withdrawal SMS notification:", err)
  );
}

// ========================================
// Notify Admin: New Deposit/Recharge Request
// ========================================

interface DepositData {
  id: string;
  amount: number;
  customerName: string;
}

export async function notifyAdminNewDeposit(data: DepositData): Promise<void> {
  console.log("Sending deposit notification to admin...");
  const subject = `[XaoSao] New Deposit Request - ${data.amount.toLocaleString()} LAK`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #10b981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f9fafb; padding: 20px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
        .info-row { margin: 10px 0; padding: 10px; background: white; border-radius: 4px; }
        .label { font-weight: bold; color: #6b7280; }
        .value { color: #111827; }
        .amount { font-size: 24px; font-weight: bold; color: #059669; }
        .button { display: inline-block; background: #10b981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin-top: 20px; }
        .footer { margin-top: 20px; font-size: 12px; color: #9ca3af; text-align: center; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2 style="margin: 0;">New Deposit Request</h2>
          <p style="margin: 5px 0 0;">A customer has requested a deposit</p>
        </div>
        <div class="content">
          <div class="info-row">
            <span class="label">Amount:</span>
            <span class="amount">${data.amount.toLocaleString()} LAK</span>
          </div>
          <div class="info-row">
            <span class="label">Customer:</span>
            <span class="value">${data.customerName}</span>
          </div>
          <div class="info-row">
            <span class="label">Requested At:</span>
            <span class="value">${new Date().toLocaleString()}</span>
          </div>

          <a href="${process.env.ADMIN_URL || "https://admin.xaosao.la"}/dashboard/transactions" class="button">
            Review Transaction
          </a>
        </div>
        <div class="footer">
          <p>This is an automated notification from XaoSao System.</p>
        </div>
      </div>
    </body>
    </html>
  `;

  // Send email without awaiting to not block the deposit flow
  sendEmail({
    to: ADMIN_EMAIL,
    subject,
    html,
  }).catch((err) => console.error("Failed to send deposit notification:", err));

  // Send SMS to admin
  const smsMessage = `XaoSao: ມີຄຳຮ້ອງເຕີມເງິນໃໝ່ - ${data.amount.toLocaleString()} LAK ຈາກ ${data.customerName}. ກະລຸນາກວດສອບ.`;
  sendAdminSMS(smsMessage).catch((err) =>
    console.error("Failed to send deposit SMS notification:", err)
  );
}

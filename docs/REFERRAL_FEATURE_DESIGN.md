# Model Referral Feature - Complete Design Document

## Overview
This document outlines the complete design for implementing a referral system where existing models can invite new models and earn rewards when the referred model is approved by admin.

### Business Logic
- **Model A** shares their referral code/link with **Model B**
- **Model B** registers with Model A's referral code (optional field)
- When **Admin approves** Model B, **Model A receives 50,000 Kip** credited to their wallet
- Transaction is recorded with type "referral"

---

## 1. Database Schema Changes

### 1.1 Add Referral Fields to Model Table

```prisma
model model {
  // ... existing fields ...

  // Referral System Fields
  referralCode       String?   @unique  // Unique code for this model to share (e.g., "XSM0001" or custom)
  referredBy         model?    @relation("ReferralRelation", fields: [referredById], references: [id])
  referredById       String?   @db.ObjectId
  referralRewardPaid Boolean   @default(false)  // Track if reward was paid for this referral
  referralRewardAt   DateTime? // When the reward was paid

  // Inverse relation for models referred by this model
  referredModels     model[]   @relation("ReferralRelation")

  // ... existing relations ...
}
```

### 1.2 Create Referral History Table (Optional - for detailed tracking)

```prisma
model referral_history {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId

  referrer        model    @relation("Referrer", fields: [referrerId], references: [id])
  referrerId      String   @db.ObjectId

  referred        model    @relation("Referred", fields: [referredId], references: [id])
  referredId      String   @db.ObjectId

  rewardAmount    Float    @default(50000)  // 50,000 Kip
  status          String   @default("pending")  // pending, paid, cancelled
  paidAt          DateTime?
  transactionId   String?  @db.ObjectId  // Link to transaction_history

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

---

## 2. API/Service Layer Changes

### 2.1 Generate Referral Code (model-auth.server.ts)

```typescript
// Generate unique referral code for a model
export function generateReferralCode(modelId: string, firstName: string): string {
  // Option 1: Use model ID prefix + random suffix
  const suffix = modelId.slice(-4).toUpperCase();
  return `XSR${suffix}`;

  // Option 2: Use first name + random numbers
  // const randomNum = Math.floor(1000 + Math.random() * 9000);
  // return `${firstName.slice(0, 3).toUpperCase()}${randomNum}`;
}
```

### 2.2 Update Model Registration (model-auth.server.ts)

```typescript
export async function modelRegister(
  modelData: IModelSignupCredentials & { referralCode?: string },
  ip: string,
  accessKey: string
) {
  // ... existing validation ...

  // Validate referral code if provided
  let referredById: string | null = null;
  if (modelData.referralCode) {
    const referrer = await prisma.model.findFirst({
      where: {
        referralCode: modelData.referralCode.toUpperCase(),
        status: 'active'  // Only active models can refer
      }
    });

    if (!referrer) {
      throw new Error("modelAuth.serverMessages.invalidReferralCode");
    }

    referredById = referrer.id;
  }

  // Create model with referral info
  const model = await prisma.model.create({
    data: {
      // ... existing fields ...
      referralCode: generateReferralCode(model.id, modelData.firstName),
      referredById: referredById,
      referralRewardPaid: false,
    },
  });

  // ... rest of existing code ...
}
```

### 2.3 Create Referral Reward Service (referral.server.ts)

```typescript
import { prisma } from "./database.server";
import { createAuditLogs } from "./log.server";

const REFERRAL_REWARD_AMOUNT = 50000; // 50,000 Kip

export async function processReferralReward(approvedModelId: string, adminId: string) {
  const auditBase = {
    action: "PROCESS_REFERRAL_REWARD",
    model: approvedModelId,
  };

  try {
    // Get the approved model with referral info
    const approvedModel = await prisma.model.findUnique({
      where: { id: approvedModelId },
      include: {
        referredBy: {
          include: {
            Wallet: true
          }
        }
      }
    });

    // Check if model was referred and reward not yet paid
    if (!approvedModel?.referredById || approvedModel.referralRewardPaid) {
      return { success: false, message: "No pending referral reward" };
    }

    const referrer = approvedModel.referredBy;
    if (!referrer || referrer.status !== 'active') {
      return { success: false, message: "Referrer not found or inactive" };
    }

    const referrerWallet = referrer.Wallet?.[0];
    if (!referrerWallet) {
      return { success: false, message: "Referrer wallet not found" };
    }

    // Use transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx) => {
      // 1. Update referrer's wallet balance
      const updatedWallet = await tx.wallet.update({
        where: { id: referrerWallet.id },
        data: {
          totalBalance: referrerWallet.totalBalance + REFERRAL_REWARD_AMOUNT,
          totalDeposit: referrerWallet.totalDeposit + REFERRAL_REWARD_AMOUNT,
        },
      });

      // 2. Create transaction record
      const transaction = await tx.transaction_history.create({
        data: {
          identifier: "referral",
          amount: REFERRAL_REWARD_AMOUNT,
          status: "approved",
          comission: 0,
          fee: 0,
          modelId: referrer.id,
          reason: `Referral reward for inviting ${approvedModel.firstName} (${approvedModel.username})`,
          approvedById: adminId,
        },
      });

      // 3. Mark referral reward as paid
      await tx.model.update({
        where: { id: approvedModelId },
        data: {
          referralRewardPaid: true,
          referralRewardAt: new Date(),
        },
      });

      return { wallet: updatedWallet, transaction };
    });

    await createAuditLogs({
      ...auditBase,
      description: `Referral reward of ${REFERRAL_REWARD_AMOUNT} Kip paid to ${referrer.username} for referring ${approvedModel.username}`,
      status: "success",
      onSuccess: result,
    });

    return {
      success: true,
      message: "Referral reward processed successfully",
      data: result,
    };
  } catch (error) {
    console.error("PROCESS_REFERRAL_REWARD_FAILED", error);
    await createAuditLogs({
      ...auditBase,
      description: "Failed to process referral reward",
      status: "failed",
      onError: error,
    });
    throw error;
  }
}

// Get referral stats for a model
export async function getModelReferralStats(modelId: string) {
  const model = await prisma.model.findUnique({
    where: { id: modelId },
    select: {
      referralCode: true,
      referredModels: {
        select: {
          id: true,
          firstName: true,
          username: true,
          profile: true,
          status: true,
          referralRewardPaid: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!model) return null;

  const totalReferred = model.referredModels.length;
  const approvedReferred = model.referredModels.filter(m => m.status === 'active' && m.referralRewardPaid).length;
  const pendingReferred = model.referredModels.filter(m => m.status === 'pending').length;
  const totalEarnings = approvedReferred * REFERRAL_REWARD_AMOUNT;

  return {
    referralCode: model.referralCode,
    referralLink: `https://xaosao.com/model-auth/register?ref=${model.referralCode}`,
    stats: {
      totalReferred,
      approvedReferred,
      pendingReferred,
      totalEarnings,
    },
    referredModels: model.referredModels,
  };
}
```

### 2.4 Update Admin Approval Function

When admin approves a model, call the referral reward function:

```typescript
// In admin model approval action
export async function approveModel(modelId: string, adminId: string) {
  // ... existing approval logic ...

  await prisma.model.update({
    where: { id: modelId },
    data: {
      status: 'active',
      approveById: adminId,
    },
  });

  // Process referral reward if applicable
  await processReferralReward(modelId, adminId);

  // ... rest of existing code ...
}
```

---

## 3. UI Components

### 3.1 Registration Form - Referral Code Field

**File: `app/routes/model-auth/register.tsx`**

Add referral code field after the interests section:

```tsx
{/* Referral Code Field */}
<div className="col-span-2">
  <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 mb-1">
    {t("modelAuth.register.referralCode")}
  </label>
  <input
    id="referralCode"
    name="referralCode"
    type="text"
    placeholder={t("modelAuth.register.referralCodePlaceholder")}
    defaultValue={searchParams.get("ref") || ""}
    className="text-sm appearance-none block w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500 uppercase"
    maxLength={10}
  />
  <p className="text-xs text-gray-500 mt-1">
    {t("modelAuth.register.referralCodeHint")}
  </p>
</div>
```

### 3.2 Model Profile - Referral Dashboard

**Create: `app/routes/model/referral.tsx`**

```tsx
import { useTranslation } from "react-i18next";
import { useLoaderData } from "react-router";
import { Copy, Share2, Users, Gift, Clock, CheckCircle } from "lucide-react";
import { Button } from "~/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { formatCurrency } from "~/utils";

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const referralStats = await getModelReferralStats(modelId);
  return { referralStats };
}

export default function ModelReferralPage() {
  const { t } = useTranslation();
  const { referralStats } = useLoaderData<typeof loader>();

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    // Show toast
  };

  return (
    <div className="container mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold">{t("modelReferral.title")}</h1>
        <p className="text-gray-600">{t("modelReferral.subtitle")}</p>
      </div>

      {/* Referral Code Card */}
      <Card className="bg-gradient-to-r from-rose-500 to-pink-500 text-white">
        <CardContent className="p-6">
          <div className="text-center space-y-4">
            <p className="text-sm opacity-90">{t("modelReferral.yourCode")}</p>
            <div className="flex items-center justify-center gap-2">
              <span className="text-3xl font-bold tracking-wider">
                {referralStats.referralCode}
              </span>
              <Button
                size="sm"
                variant="ghost"
                className="text-white hover:bg-white/20"
                onClick={() => copyToClipboard(referralStats.referralCode)}
              >
                <Copy className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex gap-2 justify-center">
              <Button
                variant="secondary"
                className="bg-white text-rose-500 hover:bg-gray-100"
                onClick={() => copyToClipboard(referralStats.referralLink)}
              >
                <Share2 className="h-4 w-4 mr-2" />
                {t("modelReferral.shareLink")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Users className="h-8 w-8 mx-auto text-blue-500 mb-2" />
            <p className="text-2xl font-bold">{referralStats.stats.totalReferred}</p>
            <p className="text-xs text-gray-500">{t("modelReferral.stats.totalReferred")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <CheckCircle className="h-8 w-8 mx-auto text-green-500 mb-2" />
            <p className="text-2xl font-bold">{referralStats.stats.approvedReferred}</p>
            <p className="text-xs text-gray-500">{t("modelReferral.stats.approved")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Clock className="h-8 w-8 mx-auto text-orange-500 mb-2" />
            <p className="text-2xl font-bold">{referralStats.stats.pendingReferred}</p>
            <p className="text-xs text-gray-500">{t("modelReferral.stats.pending")}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Gift className="h-8 w-8 mx-auto text-rose-500 mb-2" />
            <p className="text-2xl font-bold">{formatCurrency(referralStats.stats.totalEarnings)}</p>
            <p className="text-xs text-gray-500">{t("modelReferral.stats.totalEarnings")}</p>
          </CardContent>
        </Card>
      </div>

      {/* Reward Info */}
      <Card className="bg-green-50 border-green-200">
        <CardContent className="p-4 flex items-center gap-4">
          <Gift className="h-10 w-10 text-green-500" />
          <div>
            <p className="font-semibold text-green-700">
              {t("modelReferral.rewardInfo.title")}
            </p>
            <p className="text-sm text-green-600">
              {t("modelReferral.rewardInfo.description", { amount: "50,000" })}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Referred Models List */}
      <Card>
        <CardHeader>
          <CardTitle>{t("modelReferral.referredModels")}</CardTitle>
        </CardHeader>
        <CardContent>
          {referralStats.referredModels.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>{t("modelReferral.noReferrals")}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {referralStats.referredModels.map((model) => (
                <div
                  key={model.id}
                  className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <img
                      src={model.profile || "/default-avatar.png"}
                      alt={model.firstName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <p className="font-medium">{model.firstName}</p>
                      <p className="text-xs text-gray-500">@{model.username}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-1 rounded-full text-xs ${
                        model.status === "active"
                          ? "bg-green-100 text-green-700"
                          : model.status === "pending"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-red-100 text-red-700"
                      }`}
                    >
                      {model.status}
                    </span>
                    {model.referralRewardPaid && (
                      <p className="text-xs text-green-600 mt-1">+50,000 Kip</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle>{t("modelReferral.howItWorks.title")}</CardTitle>
        </CardHeader>
        <CardContent>
          <ol className="space-y-4">
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-sm">
                1
              </span>
              <div>
                <p className="font-medium">{t("modelReferral.howItWorks.step1.title")}</p>
                <p className="text-sm text-gray-500">{t("modelReferral.howItWorks.step1.description")}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-sm">
                2
              </span>
              <div>
                <p className="font-medium">{t("modelReferral.howItWorks.step2.title")}</p>
                <p className="text-sm text-gray-500">{t("modelReferral.howItWorks.step2.description")}</p>
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="flex-shrink-0 w-6 h-6 bg-rose-500 text-white rounded-full flex items-center justify-center text-sm">
                3
              </span>
              <div>
                <p className="font-medium">{t("modelReferral.howItWorks.step3.title")}</p>
                <p className="text-sm text-gray-500">{t("modelReferral.howItWorks.step3.description")}</p>
              </div>
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

## 4. Translation Keys

### 4.1 English (en.json)

```json
{
  "modelAuth": {
    "register": {
      "referralCode": "Referral Code",
      "referralCodePlaceholder": "Enter referral code (optional)",
      "referralCodeHint": "Got a referral code from a friend? Enter it here!"
    },
    "serverMessages": {
      "invalidReferralCode": "Invalid referral code. Please check and try again."
    }
  },
  "modelReferral": {
    "title": "Referral Program",
    "subtitle": "Invite friends and earn rewards!",
    "yourCode": "Your Referral Code",
    "shareLink": "Share Link",
    "stats": {
      "totalReferred": "Total Referred",
      "approved": "Approved",
      "pending": "Pending",
      "totalEarnings": "Total Earnings"
    },
    "rewardInfo": {
      "title": "Earn 50,000 Kip per Referral!",
      "description": "When your referred model gets approved, you receive {{amount}} Kip instantly to your wallet."
    },
    "referredModels": "Your Referred Models",
    "noReferrals": "No referrals yet. Share your code to start earning!",
    "howItWorks": {
      "title": "How It Works",
      "step1": {
        "title": "Share Your Code",
        "description": "Share your unique referral code or link with friends who want to become models."
      },
      "step2": {
        "title": "They Register",
        "description": "Your friend registers using your referral code during sign-up."
      },
      "step3": {
        "title": "Get Rewarded",
        "description": "Once your friend is approved by admin, you receive 50,000 Kip in your wallet!"
      }
    }
  },
  "modelWallet": {
    "transactionTypes": {
      "referral": "Referral Reward"
    }
  }
}
```

### 4.2 Lao (lo.json)

```json
{
  "modelAuth": {
    "register": {
      "referralCode": "ລະຫັດແນະນຳ",
      "referralCodePlaceholder": "ໃສ່ລະຫັດແນະນຳ (ບໍ່ບັງຄັບ)",
      "referralCodeHint": "ມີລະຫັດແນະນຳຈາກໝູ່ບໍ? ໃສ່ທີ່ນີ້!"
    },
    "serverMessages": {
      "invalidReferralCode": "ລະຫັດແນະນຳບໍ່ຖືກຕ້ອງ. ກະລຸນາກວດສອບແລ້ວລອງໃໝ່."
    }
  },
  "modelReferral": {
    "title": "ໂປຣແກຣມແນະນຳ",
    "subtitle": "ເຊີນໝູ່ແລະຮັບລາງວັນ!",
    "yourCode": "ລະຫັດແນະນຳຂອງທ່ານ",
    "shareLink": "ແບ່ງປັນລິ້ງ",
    "stats": {
      "totalReferred": "ແນະນຳທັງໝົດ",
      "approved": "ອະນຸມັດແລ້ວ",
      "pending": "ລໍຖ້າ",
      "totalEarnings": "ລາຍໄດ້ທັງໝົດ"
    },
    "rewardInfo": {
      "title": "ຮັບ 50,000 ກີບ ຕໍ່ການແນະນຳ!",
      "description": "ເມື່ອໂມເດວທີ່ທ່ານແນະນຳຖືກອະນຸມັດ, ທ່ານຈະໄດ້ຮັບ {{amount}} ກີບ ທັນທີເຂົ້າກະເປົາເງິນ."
    },
    "referredModels": "ໂມເດວທີ່ທ່ານແນະນຳ",
    "noReferrals": "ຍັງບໍ່ມີການແນະນຳ. ແບ່ງປັນລະຫັດຂອງທ່ານເພື່ອເລີ່ມຮັບລາຍໄດ້!",
    "howItWorks": {
      "title": "ວິທີເຮັດວຽກ",
      "step1": {
        "title": "ແບ່ງປັນລະຫັດ",
        "description": "ແບ່ງປັນລະຫັດແນະນຳ ຫຼື ລິ້ງຂອງທ່ານກັບໝູ່ທີ່ຕ້ອງການເປັນໂມເດວ."
      },
      "step2": {
        "title": "ພວກເຂົາລົງທະບຽນ",
        "description": "ໝູ່ຂອງທ່ານລົງທະບຽນໂດຍໃຊ້ລະຫັດແນະນຳຂອງທ່ານ."
      },
      "step3": {
        "title": "ຮັບລາງວັນ",
        "description": "ເມື່ອໝູ່ຂອງທ່ານຖືກອະນຸມັດ, ທ່ານຈະໄດ້ຮັບ 50,000 ກີບ ເຂົ້າກະເປົາເງິນ!"
      }
    }
  },
  "modelWallet": {
    "transactionTypes": {
      "referral": "ລາງວັນແນະນຳ"
    }
  }
}
```

### 4.3 Thai (th.json)

```json
{
  "modelAuth": {
    "register": {
      "referralCode": "รหัสแนะนำ",
      "referralCodePlaceholder": "กรอกรหัสแนะนำ (ไม่บังคับ)",
      "referralCodeHint": "มีรหัสแนะนำจากเพื่อนไหม? กรอกที่นี่!"
    },
    "serverMessages": {
      "invalidReferralCode": "รหัสแนะนำไม่ถูกต้อง กรุณาตรวจสอบแล้วลองอีกครั้ง"
    }
  },
  "modelReferral": {
    "title": "โปรแกรมแนะนำ",
    "subtitle": "เชิญเพื่อนและรับรางวัล!",
    "yourCode": "รหัสแนะนำของคุณ",
    "shareLink": "แชร์ลิงก์",
    "stats": {
      "totalReferred": "แนะนำทั้งหมด",
      "approved": "อนุมัติแล้ว",
      "pending": "รอดำเนินการ",
      "totalEarnings": "รายได้ทั้งหมด"
    },
    "rewardInfo": {
      "title": "รับ 50,000 กีบ ต่อการแนะนำ!",
      "description": "เมื่อโมเดลที่คุณแนะนำได้รับการอนุมัติ คุณจะได้รับ {{amount}} กีบ ทันทีเข้ากระเป๋าเงิน"
    },
    "referredModels": "โมเดลที่คุณแนะนำ",
    "noReferrals": "ยังไม่มีการแนะนำ แชร์รหัสของคุณเพื่อเริ่มรับรายได้!",
    "howItWorks": {
      "title": "วิธีการทำงาน",
      "step1": {
        "title": "แชร์รหัส",
        "description": "แชร์รหัสแนะนำหรือลิงก์ของคุณให้เพื่อนที่ต้องการเป็นโมเดล"
      },
      "step2": {
        "title": "พวกเขาลงทะเบียน",
        "description": "เพื่อนของคุณลงทะเบียนโดยใช้รหัสแนะนำของคุณ"
      },
      "step3": {
        "title": "รับรางวัล",
        "description": "เมื่อเพื่อนของคุณได้รับการอนุมัติ คุณจะได้รับ 50,000 กีบ เข้ากระเป๋าเงิน!"
      }
    }
  },
  "modelWallet": {
    "transactionTypes": {
      "referral": "รางวัลแนะนำ"
    }
  }
}
```

---

## 5. Complete Workflow

### 5.1 Registration Flow with Referral

```
┌─────────────────────────────────────────────────────────────────┐
│                      REGISTRATION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Model A shares referral link:                               │
│     https://xaosao.com/model-auth/register?ref=XSR1234          │
│                                                                  │
│  2. Model B opens link → Registration form pre-fills ref code   │
│                                                                  │
│  3. Model B fills registration form:                            │
│     - Personal info (name, DOB, etc.)                           │
│     - Contact info (WhatsApp)                                   │
│     - Profile photo                                             │
│     - Referral code: XSR1234 (optional, pre-filled)            │
│                                                                  │
│  4. Backend validates:                                          │
│     - All required fields                                       │
│     - Referral code exists + referrer is active (if provided)   │
│                                                                  │
│  5. Creates Model B with:                                       │
│     - status: "pending"                                         │
│     - referredById: Model A's ID                                │
│     - referralCode: Auto-generated (XSR5678)                    │
│     - referralRewardPaid: false                                 │
│                                                                  │
│  6. Model B waits for admin approval                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Admin Approval Flow with Referral Reward

```
┌─────────────────────────────────────────────────────────────────┐
│                    ADMIN APPROVAL FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Admin reviews Model B's application                         │
│                                                                  │
│  2. Admin clicks "Approve" button                               │
│                                                                  │
│  3. Backend executes (in transaction):                          │
│     a. Update Model B status to "active"                        │
│     b. Check if referredById exists                             │
│     c. If yes, call processReferralReward():                    │
│        i.   Find Model A (referrer)                             │
│        ii.  Verify Model A is active                            │
│        iii. Update Model A's wallet:                            │
│             - totalBalance += 50,000                            │
│             - totalDeposit += 50,000                            │
│        iv.  Create transaction_history:                         │
│             - identifier: "referral"                            │
│             - amount: 50,000                                    │
│             - status: "approved"                                │
│             - modelId: Model A's ID                             │
│             - reason: "Referral reward for [Model B name]"      │
│        v.   Update Model B:                                     │
│             - referralRewardPaid: true                          │
│             - referralRewardAt: now()                           │
│                                                                  │
│  4. Model A receives notification (optional)                    │
│                                                                  │
│  5. Model A sees +50,000 in wallet and transaction history      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.3 Referral Dashboard Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   REFERRAL DASHBOARD FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Model A navigates to /model/referral                        │
│                                                                  │
│  2. Page loads with:                                            │
│     - Model A's unique referral code (XSR1234)                  │
│     - Shareable link                                            │
│     - Statistics:                                               │
│       • Total referred: 5                                       │
│       • Approved: 3 (earned 150,000 Kip)                        │
│       • Pending: 2                                              │
│     - List of referred models with status                       │
│                                                                  │
│  3. Model A can:                                                │
│     - Copy referral code to clipboard                           │
│     - Share link via social media/messaging                     │
│     - View detailed list of referred models                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Files to Create/Modify

### New Files to Create:
1. `app/services/referral.server.ts` - Referral business logic
2. `app/routes/model/referral.tsx` - Referral dashboard page
3. `app/interfaces/referral.ts` - TypeScript interfaces

### Files to Modify:
1. `prisma/schema.prisma` - Add referral fields to model table
2. `app/routes/model-auth/register.tsx` - Add referral code field
3. `app/services/model-auth.server.ts` - Handle referral code during registration
4. `app/i18n/locales/en.json` - Add English translations
5. `app/i18n/locales/lo.json` - Add Lao translations
6. `app/i18n/locales/th.json` - Add Thai translations
7. Admin approval action (location TBD) - Trigger referral reward
8. `app/routes/model/settings/wallet.tsx` - Display "referral" transaction type properly

### Route Configuration:
Add to `app/routes.ts`:
```typescript
route("model/referral", "routes/model/referral.tsx"),
```

---

## 7. Testing Checklist

- [ ] Generate unique referral codes for new models
- [ ] Validate referral code during registration (accept valid, reject invalid)
- [ ] Pre-fill referral code from URL parameter (?ref=XSR1234)
- [ ] Store referredById when model registers with valid code
- [ ] Process referral reward when admin approves referred model
- [ ] Create transaction with identifier "referral"
- [ ] Update referrer's wallet balance correctly
- [ ] Mark referralRewardPaid as true after processing
- [ ] Display referral stats on dashboard
- [ ] Copy referral code/link functionality
- [ ] Display referred models list with status
- [ ] Show referral transactions in wallet history
- [ ] Handle edge cases:
  - [ ] Referrer becomes inactive before approval
  - [ ] Duplicate referral code attempts
  - [ ] Self-referral prevention
  - [ ] Already used referral reward

---

## 8. Security Considerations

1. **Self-referral Prevention**: Ensure a model cannot use their own referral code
2. **Referral Code Validation**: Only active models can have valid referral codes
3. **Transaction Atomicity**: Use database transactions to prevent partial updates
4. **Rate Limiting**: Consider limiting referral rewards per time period
5. **Audit Logging**: Log all referral-related actions for tracking

---

## 9. Future Enhancements

1. **Tiered Rewards**: Different reward amounts based on referral count
2. **Time-Limited Campaigns**: Special referral bonuses during promotions
3. **Customer Referrals**: Extend system to customer-refers-customer
4. **Referral Leaderboard**: Gamification with top referrers
5. **Push Notifications**: Notify referrer when reward is earned
6. **QR Code**: Generate QR code for easy sharing
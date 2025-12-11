import { useState, useEffect } from "react";
import { AlertCircle, Send, Loader } from "lucide-react";
import { Form, useNavigation, useSearchParams, redirect } from "react-router";
import type { MetaFunction, LoaderFunctionArgs, ActionFunctionArgs } from "react-router";
import { useTranslation } from "react-i18next";

// components:
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import { Button } from "~/components/ui/button";
import { Textarea } from "~/components/ui/textarea";

// services:
import { createModelReport } from "~/services/model.server";
import { requireModelSession } from "~/services/model-auth.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Report an Issue - Model Settings" },
    { name: "description", content: "Report technical issues or problems" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  await requireModelSession(request);
  return null;
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();

  const title = formData.get("title") as string;
  const issueType = formData.get("issueType") as string;
  const description = formData.get("description") as string;

  if (!issueType || !title || !description) {
    return redirect(
      `/model/settings/report?error=${encodeURIComponent("modelReport.errors.allFieldsRequired")}`
    );
  }

  try {
    const result = await createModelReport(modelId, issueType, title, description);

    if (result?.success) {
      return redirect(
        `/model/settings/report?success=${encodeURIComponent("modelReport.success.submitted")}`
      );
    } else {
      return redirect(
        `/model/settings/report?error=${encodeURIComponent("modelReport.errors.submitFailed")}`
      );
    }
  } catch (error: any) {
    return redirect(
      `/model/settings/report?error=${encodeURIComponent(error.message || "modelReport.errors.submitFailed")}`
    );
  }
}

export default function ReportSettings() {
  const { t } = useTranslation();
  const navigation = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const isSubmitting = navigation.state === "submitting";

  const [title, setTitle] = useState("");
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");

  const errorMessage = searchParams.get("error");
  const successMessage = searchParams.get("success");

  // Clear form fields on success and clear messages after 5 seconds
  useEffect(() => {
    if (successMessage) {
      setIssueType("");
      setTitle("");
      setDescription("");

      const timeout = setTimeout(() => {
        searchParams.delete("success");
        setSearchParams(searchParams, { replace: true });
      }, 5000);
      return () => clearTimeout(timeout);
    }

    if (errorMessage) {
      const timeout = setTimeout(() => {
        searchParams.delete("error");
        setSearchParams(searchParams, { replace: true });
      }, 5000);
      return () => clearTimeout(timeout);
    }
  }, [successMessage, errorMessage, searchParams, setSearchParams]);

  return (
    <div className="p-2 sm:p-4 lg:p-0 space-y-2 sm:space-y-4">
      <div className="mb-6 lg:hidden">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-rose-100 rounded-lg">
            <AlertCircle className="w-4 h-4 text-rose-600" />
          </div>
          <div>
            <h1 className="text-md">
              {t("modelReport.title")}
            </h1>
            <p className="text-sm text-gray-600">{t("modelReport.subtitle")}</p>
          </div>
        </div>
      </div>

      {successMessage && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-sm text-green-800">{t(successMessage)}</p>
        </div>
      )}

      {errorMessage && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-800">{t(errorMessage)}</p>
        </div>
      )}

      <div className="bg-white rounded-sm p-3 sm:p-6 border">
        <Form method="post" className="space-y-4 sm:space-y-6">
          <div className="space-y-2">
            <Label htmlFor="issueType">
              {t("modelReport.issueType")} <span className="text-rose-500">*</span>
            </Label>
            <Select
              name="issueType"
              value={issueType}
              onValueChange={setIssueType}
              required
              disabled={isSubmitting}
            >
              <SelectTrigger id="issueType" className="w-full">
                <SelectValue placeholder={t("modelReport.selectIssueType")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="technical">{t("modelReport.issueTypes.technical")}</SelectItem>
                <SelectItem value="payment">{t("modelReport.issueTypes.payment")}</SelectItem>
                <SelectItem value="account">{t("modelReport.issueTypes.account")}</SelectItem>
                <SelectItem value="chat">{t("modelReport.issueTypes.chat")}</SelectItem>
                <SelectItem value="profile">{t("modelReport.issueTypes.profile")}</SelectItem>
                <SelectItem value="other">{t("modelReport.issueTypes.other")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="title">
              {t("modelReport.subject")} <span className="text-rose-500">*</span>
            </Label>
            <Input
              id="title"
              name="title"
              type="text"
              placeholder={t("modelReport.subjectPlaceholder")}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              disabled={isSubmitting}
              className="text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">
              {t("modelReport.description")} <span className="text-rose-500">*</span>
            </Label>
            <Textarea
              id="description"
              name="description"
              rows={6}
              placeholder={t("modelReport.descriptionPlaceholder")}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
              maxLength={500}
              disabled={isSubmitting}
              className="resize-none text-sm"
            />
            <p className="text-xs text-gray-500">
              {description.length}/500 {t("modelReport.characters")}
            </p>
          </div>

          <div className="w-full flex justify-end sm:justify-start">
            <Button
              type="submit"
              className="w-auto bg-rose-500 text-white hover:bg-rose-600"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loader size={18} className="animate-spin" /> : <Send className="w-4 h-4" />}
              {isSubmitting ? t("modelReport.submitting") : t("modelReport.submitReport")}
            </Button>
          </div>
        </Form>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-sm p-4 mb-6">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-md text-blue-700 font-medium mb-1">{t("modelReport.help.title")}</p>
            <p className="text-sm text-blue-700">
              {t("modelReport.help.message")}{" "}
              <a href="mailto:support@xaosao.com" className="underline font-medium">
                support@xaosao.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

import { useTranslation } from "react-i18next";
import { Form, redirect, useActionData, useLoaderData, useNavigate, useNavigation, type ActionFunctionArgs, type LoaderFunction } from "react-router";
import { ArrowLeft, Coins, Loader, Send } from "lucide-react";

import { Button } from "~/components/ui/button";
import { requireUserSession } from "~/services/auths.server";
import { createPost, getActiveServices } from "~/services/post.server";
import { checkProfanity } from "~/utils/profanityFilter";

interface LoaderReturn {
  services: { id: string; name: string }[];
}

export const loader: LoaderFunction = async ({ request }) => {
  await requireUserSession(request);
  const services = await getActiveServices();
  return { services };
};

export async function action({ request }: ActionFunctionArgs) {
  const customerId = await requireUserSession(request);
  const formData = await request.formData();

  const content = formData.get("content") as string;
  if (!content?.trim()) {
    return { error: true, message: "posts.create.contentRequired" };
  }

  // Check profanity before creating post
  const profanityCheck = checkProfanity(content.trim());
  if (profanityCheck.blocked) {
    return { error: true, profanity: true, matchedWord: profanityCheck.matchedWord || "", message: "posts.create.profanityBlocked" };
  }

  try {
    await createPost({
      authorType: "customer",
      customerId,
      content: content.trim(),
      serviceId: (formData.get("serviceId") as string) || undefined,
      targetGender: (formData.get("targetGender") as string) || undefined,
      location: (formData.get("location") as string) || undefined,
      targetAgeMin: formData.get("targetAgeMin") ? parseInt(formData.get("targetAgeMin") as string) : undefined,
      targetAgeMax: formData.get("targetAgeMax") ? parseInt(formData.get("targetAgeMax") as string) : undefined,
      preferredDate: formData.get("preferredDate") ? new Date(formData.get("preferredDate") as string) : undefined,
      preferredTime: (formData.get("preferredTime") as string) || undefined,
      hasTip: formData.get("hasTip") === "on",
    });

    return redirect("/customer/posts");
  } catch (error: any) {
    const msg = error?.message || "";
    if (msg.startsWith("PROFANITY_BLOCKED:")) {
      const word = msg.split(":")[1] || "";
      return { error: true, profanity: true, matchedWord: word, message: "posts.create.profanityBlocked" };
    }
    return { error: true, message: msg || "posts.create.profanityBlocked" };
  }
}

export default function CreateCustomerPost() {
  const { services } = useLoaderData<LoaderReturn>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isSubmitting = navigation.state !== "idle";

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <button
        onClick={() => navigate("/customer/posts")}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-rose-500 mb-4"
      >
        <ArrowLeft className="h-4 w-4" />
        {t("posts.backToPosts", { defaultValue: "Back to Posts" })}
      </button>

      <h1 className="text-lg font-bold mb-4">{t("posts.create.title", { defaultValue: "Create Request" })}</h1>

      <Form method="post" className="space-y-4">
        {/* Content */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            {t("posts.create.whatLookingFor", { defaultValue: "What are you looking for?" })}
          </label>
          <textarea
            name="content"
            rows={3}
            required
            maxLength={500}
            placeholder={t("posts.create.contentPlaceholder", { defaultValue: "E.g., I want 2 girls for drinking tonight in Vientiane..." })}
            className="w-full border rounded-lg p-3 text-sm focus:ring-2 focus:ring-rose-300 focus:border-rose-300 outline-none resize-none"
          />
        </div>

        {/* Service */}
        <div>
          <label className="text-sm font-medium text-gray-700 block mb-1">
            {t("posts.create.service", { defaultValue: "Service" })}
          </label>
          <select name="serviceId" defaultValue={services.find((s) => s.name === "drinkingFriend")?.id || ""} className="w-full border rounded-lg p-2.5 text-sm bg-white">
            <option value="">{t("posts.create.anyService", { defaultValue: "Any service" })}</option>
            {services.map((s) => (
              <option key={s.id} value={s.id}>
                {t(`modelServices.serviceItems.${s.name}.name`, { defaultValue: s.name })}
              </option>
            ))}
          </select>
        </div>

        {/* Gender & Count */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {t("posts.create.gender", { defaultValue: "Gender" })}
            </label>
            <select name="targetGender" className="w-full border rounded-lg p-2.5 text-sm bg-white">
              <option value="">{t("posts.create.anyGender", { defaultValue: "Any" })}</option>
              <option value="female">{t("posts.create.female", { defaultValue: "Female" })}</option>
              <option value="male">{t("posts.create.male", { defaultValue: "Male" })}</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {t("posts.create.location", { defaultValue: "Location" })}
            </label>
            <input
              type="text"
              name="location"
              placeholder={t("posts.create.locationPlaceholder", { defaultValue: "e.g. Vientiane" })}
              className="w-full border rounded-lg p-2.5 text-sm"
            />
          </div>
        </div>

        {/* Age Range */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {t("posts.create.ageMin", { defaultValue: "Min Age" })}
            </label>
            <input
              type="number"
              name="targetAgeMin"
              min={18}
              max={60}
              placeholder="18"
              className="w-full border rounded-lg p-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {t("posts.create.ageMax", { defaultValue: "Max Age" })}
            </label>
            <input
              type="number"
              name="targetAgeMax"
              min={18}
              max={60}
              placeholder="30"
              className="w-full border rounded-lg p-2.5 text-sm"
            />
          </div>
        </div>

        {/* Date & Time */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {t("posts.create.date", { defaultValue: "Date" })}
            </label>
            <input
              type="date"
              name="preferredDate"
              className="w-full border rounded-lg p-2.5 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700 block mb-1">
              {t("posts.create.time", { defaultValue: "Time" })}
            </label>
            <input
              type="text"
              name="preferredTime"
              placeholder="7:00 PM - 10:00 PM"
              className="w-full border rounded-lg p-2.5 text-sm"
            />
          </div>
        </div>

        {/* Tip */}
        <label className="flex items-center gap-3 p-3 border rounded-lg cursor-pointer transition-colors border border-yellow-300 bg-yellow-50">
          <input type="checkbox" name="hasTip" className="w-4 h-4 accent-amber-500 rounded" />
          <Coins className="h-5 w-5 text-amber-500 flex-shrink-0" />
          <div>
            <span className="text-sm font-medium text-gray-700">
              {t("posts.create.hasTip", { defaultValue: "I'll give a tip" })}
            </span>
            <p className="text-xs text-gray-400">
              {t("posts.create.hasTipHint", { defaultValue: "Let models know you'll tip" })}
            </p>
          </div>
        </label>

        {/* Error */}
        {actionData?.error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {actionData.profanity
              ? t("posts.create.profanityBlocked", { defaultValue: "We do not allow inappropriate language in creating posts. Please review and try again!" })
              : t(actionData.message, { defaultValue: actionData.message })}
          </div>
        )}

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate("/customer/posts")}
            className="flex-1"
          >
            {t("posts.create.cancel", { defaultValue: "Cancel" })}
          </Button>
          <Button
            type="submit"
            disabled={isSubmitting}
            className="flex-1 bg-rose-500 hover:bg-rose-600 text-white"
          >
            {isSubmitting ? (
              <Loader className="h-4 w-4 animate-spin mr-1" />
            ) : (
              <Send className="h-4 w-4 mr-1" />
            )}
            {t("posts.create.submit", { defaultValue: "Post & Notify" })}
          </Button>
        </div>
      </Form>
    </div>
  );
}

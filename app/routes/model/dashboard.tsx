import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Heart, Loader } from "lucide-react";
import type { LoaderFunctionArgs, MetaFunction, ActionFunctionArgs } from "react-router";
import { useLoaderData, useFetcher, useNavigate, redirect, useNavigation } from "react-router";

// service and components:
import CustomerCard from "~/components/CustomerCard";
import { modelAddFriend } from "~/services/interaction.server";
import { getForYouCustomers, createModelInteraction } from "~/services/model.server";
import { requireModelSession, getModelTokenFromSession } from "~/services/model-auth.server";

export const meta: MetaFunction = () => {
  return [
    { title: "Discover Customers - Model Dashboard" },
    { name: "description", content: "Browse active customers" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);

  if (!modelId) {
    throw new Response("Unauthorized", { status: 401 });
  }

  // Get page from URL params
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page")) || 1;

  // Get model's profile data
  const { getModelDashboardData } = await import("~/services/model.server");
  const modelData = await getModelDashboardData(modelId);

  const result = await getForYouCustomers(modelId, {
    page,
    perPage: 20,
  });

  return {
    customers: result.customers,
    pagination: result.pagination,
    modelId,
    modelLatitude: modelData?.latitude || 0,
    modelLongitude: modelData?.longitude || 0,
  };
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const token = await getModelTokenFromSession(request);
  const formData = await request.formData();
  const like = formData.get("like") === "true";
  const pass = formData.get("pass") === "true";
  const addFriend = formData.get("isFriend") === "true";
  const customerId = formData.get("customerId") as string;

  // Check if token exists
  if (!token) {
    return redirect(`/model?toastMessage=${encodeURIComponent("modelDashboard.errors.authenticationError")}&toastType=error`);
  }

  if (request.method === "POST") {
    if (addFriend === true) {
      try {
        const res = await modelAddFriend(modelId, customerId, token);
        if (res?.success) {
          return redirect(`/model?toastMessage=${encodeURIComponent("modelDashboard.success.addFriend")}&toastType=success`);
        } else {
          return redirect(`/model?toastMessage=${encodeURIComponent(res?.message || "modelDashboard.errors.failedToAddFriend")}&toastType=error`);
        }
      } catch (error: any) {
        return redirect(`/model?toastMessage=${encodeURIComponent(error.message || "modelDashboard.errors.failedToAddFriend")}&toastType=error`);
      }
    } else {
      if (like === false && pass === false) {
        return { success: false, error: true, message: "modelDashboard.errors.invalidAction" };
      }
      const actionType = like === true ? "LIKE" : "PASS";
      try {
        const res = await createModelInteraction(modelId, customerId, actionType as "LIKE" | "PASS");
        if (res?.success) {
          return redirect(`/model?toastMessage=${encodeURIComponent("modelDashboard.success.interaction")}&toastType=success`);
        }
      } catch (error: any) {
        return redirect(`/model?toastMessage=${encodeURIComponent(error.message)}&toastType=error`);
      }
    }
  }
  return redirect(`/model?toastMessage=${encodeURIComponent("modelDashboard.errors.invalidRequestMethod")}&toastType=warning`);
}

export default function ModelDashboard() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const fetcher = useFetcher<typeof loader>();
  const initialData = useLoaderData<typeof loader>();
  const [customers, setCustomers] = useState(initialData.customers);
  const [hasMore, setHasMore] = useState(initialData.pagination.hasNextPage);
  const [currentPage, setCurrentPage] = useState(initialData.pagination.currentPage);

  const isSubmitting = navigation.state !== "idle" && navigation.formMethod === "POST";

  useEffect(() => {
    setCustomers(initialData.customers);
    setCurrentPage(initialData.pagination.currentPage);
    setHasMore(initialData.pagination.hasNextPage);
  }, [initialData]);

  // When fetcher completes, append new customers
  if (fetcher.data && fetcher.state === "idle") {
    if (fetcher.data.customers && fetcher.data.customers.length > 0) {
      const newCustomers = fetcher.data.customers.filter(
        (newCustomer: any) => !customers.some((c: any) => c.id === newCustomer.id)
      );
      if (newCustomers.length > 0) {
        setCustomers((prev) => [...prev, ...newCustomers]);
        setHasMore(fetcher.data.pagination.hasNextPage);
      }
    }
  }

  const handleLoadMore = () => {
    const nextPage = currentPage + 1;
    setCurrentPage(nextPage);
    fetcher.load(`?page=${nextPage}`);
  };

  const handleViewProfile = (customerId: string) => {
    navigate(`/model/customer-profile/${customerId}`);
  };

  if (isSubmitting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2">
          <Loader className="w-4 h-4 text-rose-500 animate-spin" />
          <p className="text-rose-600">{t('discover.processing')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 sm:p-6">
      <div className="mb-8 space-y-1 sm:space-y-2">
        <h1 className="text-lg sm:text-xl text-rose-500 text-shadow-sm">
          {t("modelDashboard.title")}
        </h1>
        <p className="text-sm text-gray-600">
          {t("modelDashboard.subtitle")}
        </p>
      </div>

      {customers.length > 0 ? (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-4">
            {customers.map((customer: any) => (
              <CustomerCard
                key={customer.id}
                customer={customer}
                modelLatitude={initialData.modelLatitude}
                modelLongitude={initialData.modelLongitude}
                onViewProfile={handleViewProfile}
              />
            ))}
          </div>

          {hasMore && (
            <div className="flex justify-center mt-12">
              <button
                onClick={handleLoadMore}
                disabled={fetcher.state === "loading"}
                className="group relative bg-gradient-to-r from-rose-500 to-purple-600 text-white px-8 py-4 rounded-xl font-semibold text-lg shadow-lg hover:shadow-2xl hover:from-rose-600 hover:to-purple-700 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-3"
              >
                {fetcher.state === "loading" ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{t("modelDashboard.loadingMore")}</span>
                  </>
                ) : (
                  <>
                    <span>{t("modelDashboard.loadMoreCustomers")}</span>
                    <div className="bg-white/20 rounded-full p-1">
                      <Heart className="w-4 h-4" />
                    </div>
                  </>
                )}
              </button>
            </div>
          )}

          <div className="text-center mt-6 text-gray-500 text-sm">
            {t("modelDashboard.showingCustomers", { count: customers.length })}
          </div>
        </>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 px-4">
          <div className="bg-white rounded-2xl shadow-xl p-12 max-w-md text-center">
            <div className="text-6xl mb-6">💕</div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">
              {t("modelDashboard.noCustomersTitle")}
            </h3>
            <p className="text-gray-600 mb-6">
              {t("modelDashboard.noCustomersMessage")}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="bg-gradient-to-r from-rose-500 to-purple-600 text-white px-6 py-3 rounded-lg font-medium hover:from-rose-600 hover:to-purple-700 transition-all duration-300"
            >
              {t("modelDashboard.refreshPage")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

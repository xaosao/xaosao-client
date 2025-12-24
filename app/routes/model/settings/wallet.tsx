import {
  Eye,
  Trash,
  EyeOff,
  Wallet,
  Search,
  Loader,
  EyeIcon,
  FilePenLine,
  MoreVertical,
  ArrowDownToLine,
} from "lucide-react";
import {
  Link,
  Form,
  Outlet,
  redirect,
  useNavigate,
  useNavigation,
  useSearchParams,
  useLoaderData,
} from "react-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs, ActionFunctionArgs } from "react-router";

// Services and Utils
import { formatCurrency } from "~/utils";
import type { IWalletResponse } from "~/interfaces";
import { capitalize } from "~/utils/functions/textFormat";
import type { IModelBank } from "~/interfaces/model-profile";
import type { PaginationProps } from "~/interfaces/pagination";
import { getModelBanks } from "~/services/model-profile.server";
import { requireModelSession } from "~/services/model-auth.server";
import type { ITransactionResponse } from "~/interfaces/transaction";

import {
  withdrawFunds,
  getWalletByModelId,
  getModelTransactions,
} from "~/services/wallet.server";

// components
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "~/components/ui/dropdown-menu";
import { Button } from "~/components/ui/button";
import { Input } from "~/components/ui/input";
import { Label } from "~/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "~/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "~/components/ui/dialog";
import Pagination from "~/components/ui/pagination";
import { Separator } from "~/components/ui/separator";

interface LoaderReturn {
  wallet: IWalletResponse;
  transactions: ITransactionResponse[];
  pagination: PaginationProps;
  banks: IModelBank[];
}

export async function loader({ request }: LoaderFunctionArgs) {
  const modelId = await requireModelSession(request);
  const url = new URL(request.url);
  const page = Number(url.searchParams.get("page") || 1);
  const take = 10;

  const [wallet, { transactions, pagination }, banks] = await Promise.all([
    getWalletByModelId(modelId),
    getModelTransactions(modelId, page, take),
    getModelBanks(modelId),
  ]);

  return { wallet, transactions, pagination, banks };
}

export async function action({ request }: ActionFunctionArgs) {
  const modelId = await requireModelSession(request);
  const formData = await request.formData();

  const actionType = formData.get("actionType") as string;

  if (actionType === "withdraw") {
    const amount = parseFloat(formData.get("amount") as string);
    const bankAccount = formData.get("bankAccount") as string;

    const result = await withdrawFunds(modelId, amount, bankAccount);

    if (result?.success) {
      return redirect(
        `/model/settings/wallet?toastMessage=${encodeURIComponent("modelWallet.success.withdrawalSubmitted")}&toastType=success`
      );
    } else {
      return redirect(
        `/model/settings/wallet?toastMessage=${encodeURIComponent(result?.message || "modelWallet.errors.withdrawalFailed")}&toastType=error`
      );
    }
  }

  return null;
}

export default function ModelWalletPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const navigation = useNavigation();
  const [searchParams] = useSearchParams();
  const isLoading = navigation.state === "loading";
  const { wallet, transactions, pagination, banks } = useLoaderData<LoaderReturn>();

  // For toast messages
  const toastType = searchParams.get("toastType");
  const toastMessage = searchParams.get("toastMessage");
  const showToast = (
    message: string,
    type: "success" | "error" | "warning" = "success",
    duration = 3000
  ) => {
    searchParams.set("toastMessage", message);
    searchParams.set("toastType", type);
    searchParams.set("toastDuration", String(duration));
    navigate({ search: searchParams.toString() }, { replace: true });
  };
  React.useEffect(() => {
    if (toastMessage) {
      showToast(toastMessage, toastType as any);
    }
  }, [toastMessage, toastType]);

  const [isBalanceVisible, setIsBalanceVisible] = useState(false);
  const [activeTab, setActiveTab] = useState("All");
  const [withdrawModal, setWithdrawModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState<string>("");
  const [selectedBank, setSelectedBank] = useState<string>("");

  // Safety reset: ensure body styles are clean when wallet page renders
  // This handles cases where modal cleanup didn't run properly during navigation
  React.useEffect(() => {
    // Only reset if body has modal-related styles applied
    if (document.body.style.position === 'fixed') {
      const scrollY = Math.abs(parseInt(document.body.style.top || '0', 10));
      document.body.style.overflow = '';
      document.body.style.position = '';
      document.body.style.width = '';
      document.body.style.top = '';
      window.scrollTo(0, scrollY);
    }
  }, []);

  const tabs = [
    { key: "All", label: t("modelWallet.tabs.all") },
    { key: "Approved", label: t("modelWallet.tabs.approved") },
    { key: "Pending", label: t("modelWallet.tabs.pending") },
    { key: "Failed", label: t("modelWallet.tabs.failed") },
  ];

  // Close withdraw modal when form submission starts
  React.useEffect(() => {
    if (isLoading) {
      setWithdrawModal(false);
    }
  }, [isLoading]);

  const filteredTransactions = transactions.filter((transaction) => {
    const matchesTab =
      activeTab === "All" ||
      (activeTab === "Approved" && transaction.status === "approved") ||
      (activeTab === "Failed" && transaction.status === "rejected") ||
      (activeTab === "Pending" && transaction.status === "pending");
    return matchesTab;
  });

  if (isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
        <div className="flex items-center justify-center gap-2">
          <Loader className="w-4 h-4 text-rose-500 animate-spin" />
          <p className="text-rose-600">{t("modelWallet.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full p-0 sm:p-4 lg:p-0">
        <div className="w-full space-y-2">
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4">
            <div className="bg-gradient-to-r from-rose-600 to-rose-400 rounded-md py-4 px-6 text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-10 translate-y-10"></div>
              <div className="relative z-10 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Wallet size={24} />
                    <span className="font-medium">{t("modelWallet.totalBalance")}</span>
                  </div>
                  <button
                    onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                    className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                  >
                    {isBalanceVisible ? (
                      <Eye size={20} />
                    ) : (
                      <EyeOff size={20} />
                    )}
                  </button>
                </div>

                <div className="flex items-start justify-start gap-6">
                  <div>
                    <h2 className="text-lg">
                      {isBalanceVisible
                        ? formatCurrency(wallet.totalBalance)
                        : "******"}
                    </h2>
                    <p className="text-white/80 text-sm">{t("modelWallet.availableBalance")}</p>
                  </div>

                  <div className="">
                    <p className="text-lg">
                      {isBalanceVisible
                        ? formatCurrency(wallet.totalRecharge)
                        : "******"}
                    </p>
                    <p className="text-white/80 text-sm">{t("modelWallet.totalEarnings")}</p>
                  </div>
                </div>
              </div>
            </div>
            <button
              onClick={() => setWithdrawModal(true)}
              className="hidden cursor-pointer sm:flex items-center justify-center border border-rose-500 rounded-md gap-2 hover:bg-rose-50"
            >
              <ArrowDownToLine className="text-gray-500" size={18} />
              <span className="text-gray-500">{t("modelWallet.withdrawFunds")}</span>
            </button>
          </div>

          <div className="bg-white rounded-md overflow-hidden">
            <div className="py-2 sm:py-4 px-0 sm:px-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-md sm:text-md font-normal text-gray-600">
                  {t("modelWallet.withdrawalHistory")}
                </h3>
              </div>

              <div className="space-y-4 flex flex-col sm:flex-row items-start justify-between">
                <div className="flex gap-2 overflow-x-auto">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      className={`cursor-pointer px-4 py-1 rounded-sm whitespace-nowrap font-medium text-sm transition-colors ${activeTab === tab.key
                        ? "bg-rose-100 text-rose-600 border border-rose-300"
                        : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                        }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <Separator />

            <div className="divide-y divide-gray-100 cursor-pointer">
              {filteredTransactions && filteredTransactions.length > 0 ? (
                filteredTransactions.map((transaction, index: number) => (
                  <div
                    key={transaction.id}
                    className="p-2 sm:p-4 hover:bg-gray-50 transition-colors group"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center justify-start space-x-8">
                        <p className="text-gray-500">{index + 1}</p>
                        <div className="flex items-center gap-4">
                          <div
                            className={`hidden sm:block p-3 rounded-md ${transaction.status === "approved"
                              ? "bg-green-100"
                              : transaction.status === "rejected"
                                ? "bg-red-100"
                                : "bg-orange-100"
                              }`}
                          >
                            <span
                              className={
                                transaction.status === "approved"
                                  ? "text-green-600"
                                  : transaction.status === "rejected"
                                    ? "text-red-600"
                                    : "text-orange-600"
                              }
                            >
                              LAK
                            </span>
                          </div>

                          <div>
                            <h4 className="font-medium text-gray-900">
                              {t(`transactionTypes.${transaction.identifier}`, { defaultValue: capitalize(transaction.identifier) })}
                            </h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                {transaction.createdAt.toDateString()}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-center space-y-1 space-x-4 mt-2">
                          <p
                            className={`font-semibold ${transaction.identifier === "withdrawal"
                              ? "text-red-600"
                              : "text-green-600"
                              }`}
                          >
                            {transaction.identifier === "withdrawal"
                              ? "-"
                              : "+"}
                            {formatCurrency(transaction.amount)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <p
                          className={`text-center text-xs px-2 py-1 rounded-sm ${transaction.status === "approved"
                            ? "bg-green-100 text-green-600"
                            : transaction.status === "rejected"
                              ? "bg-red-100 text-red-600"
                              : "bg-orange-100 text-orange-600"
                            }`}
                        >
                          {capitalize(transaction.status)}
                        </p>

                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-gray-500 h-8 w-8 p-0"
                            >
                              <MoreVertical className="h-3 w-3" />
                              <span className="sr-only">More</span>
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            className="w-48"
                            align="end"
                            forceMount
                          >
                            <DropdownMenuItem className="text-gray-500 text-sm">
                              <Link
                                to={`/model/settings/wallet/detail/${transaction.id}`}
                                className="flex space-x-2 w-full"
                              >
                                <EyeIcon className="mr-2 h-3 w-3" />
                                <span>{t("modelWallet.menu.viewDetails")}</span>
                              </Link>
                            </DropdownMenuItem>
                            {transaction.status === "pending" && (
                              <DropdownMenuItem className="text-sm">
                                <Link
                                  to={`/model/settings/wallet/edit/${transaction.id}`}
                                  className="text-gray-500 flex space-x-2 w-full"
                                >
                                  <FilePenLine className="mr-2 h-3 w-3" />
                                  <span>{t("modelWallet.menu.edit")}</span>
                                </Link>
                              </DropdownMenuItem>
                            )}
                            {transaction.status === "pending" && (
                              <DropdownMenuItem className="text-sm">
                                <Link
                                  to={`/model/settings/wallet/delete/${transaction.id}`}
                                  className="text-gray-500 flex space-x-2 w-full"
                                >
                                  <Trash className="mr-2 h-3 w-3" />
                                  <span>{t("modelWallet.menu.delete")}</span>
                                </Link>
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Search size={24} className="text-gray-400" />
                  </div>
                  <h4 className="text-gray-900 font-medium mb-2">
                    {t("modelWallet.noTransactions")}
                  </h4>
                  <p className="text-gray-600 text-sm">
                    {t("modelWallet.noTransactionsHint")}
                  </p>
                </div>
              )}
              {pagination.totalPages > 1 && (
                <Pagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalCount={pagination.totalCount}
                  limit={pagination.limit}
                  hasNextPage={pagination.hasNextPage}
                  hasPreviousPage={pagination.hasPreviousPage}
                  baseUrl=""
                  searchParams={searchParams}
                />
              )}
            </div>
          </div>

          <button
            onClick={() => setWithdrawModal(true)}
            className="sm:hidden fixed bottom-18 right-4 bg-rose-500 hover:bg-rose-600 text-white rounded-lg py-2 px-4 shadow-lg flex items-center justify-center z-9"
          >
            <ArrowDownToLine className="h-4 w-4" /> {t("modelWallet.withdraw")}
          </button>
        </div>
      </div>

      <Dialog open={withdrawModal} onOpenChange={setWithdrawModal}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-md font-normal">{t("modelWallet.withdrawFunds")}</DialogTitle>
          </DialogHeader>

          <div className="mb-4 p-4 bg-rose-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-1">{t("modelWallet.availableBalance")}</p>
            <h3 className="text-lg font-bold text-rose-600 flex items-center gap-1">
              {formatCurrency(wallet.totalBalance)}
            </h3>
          </div>

          <Form method="post" className="space-y-6">
            <input type="hidden" name="actionType" value="withdraw" />

            <div className="space-y-2">
              <Label htmlFor="bankAccount">
                {t("modelWallet.modal.bankAccount")} <span className="text-rose-500">*</span>
              </Label>
              <Select
                name="bankAccount"
                value={selectedBank}
                onValueChange={setSelectedBank}
                required
              >
                <SelectTrigger id="bankAccount" className="w-full">
                  <SelectValue placeholder={t("modelWallet.modal.selectBank")} />
                </SelectTrigger>
                <SelectContent>
                  {banks.length > 0 ? (
                    banks.map((bank) => (
                      <SelectItem key={bank.id} value={bank.id}>
                        {bank.bank_name} - {bank.bank_account_name} (****{bank.bank_account_number.slice(-4)})
                      </SelectItem>
                    ))
                  ) : (
                    <div className="px-2 py-4 text-sm text-gray-500 text-center">
                      {t("modelWallet.modal.noBanks")}
                    </div>
                  )}
                </SelectContent>
              </Select>
              {banks.length === 0 && (
                <p className="text-xs text-orange-500">
                  {t("modelWallet.modal.addBankHint")}
                </p>
              )}
              <p className="text-xs text-gray-500">
                {t("modelWallet.modal.selectBankHint")}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">
                {t("modelWallet.modal.withdrawalAmount")} <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">Kip</span>
                <Input
                  id="amount"
                  type="number"
                  name="amount"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                  step="0.01"
                  min="0.01"
                  max={wallet.totalBalance}
                  required
                  className="pl-10 text-sm"
                  placeholder={t("modelWallet.modal.enterAmount")}
                />
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-sm">
              <p className="text-xs text-blue-800">
                <strong>{t("modelWallet.modal.note")}</strong> {t("modelWallet.modal.withdrawNote")}
              </p>
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setWithdrawModal(false)}
              >
                {t("modelWallet.modal.close")}
              </Button>
              {banks.length > 0 ? (
                <Button
                  type="submit"
                  disabled={!selectedBank}
                  className="bg-rose-500 text-white cursor-pointer hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {t("modelWallet.withdraw")}
                </Button>
              ) : (
                <Button
                  type="button"
                  className="bg-rose-500 text-white cursor-pointer hover:bg-rose-600"
                  onClick={() => {
                    setWithdrawModal(false);
                    navigate("/model/profile?tab=banks");
                  }}
                >
                  {t("modelWallet.modal.addBankAccount")}
                </Button>
              )}
            </DialogFooter>
          </Form>
        </DialogContent>
      </Dialog>

      <Outlet />
    </>
  );
}

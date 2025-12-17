import React, { useState } from 'react';
import {
    Eye,
    Trash,
    EyeOff,
    Wallet,
    Search,
    Loader,
    EyeIcon,
    PlusIcon,
    DollarSign,
    FilePenLine,
    MoreVertical,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Link, useNavigate, useNavigation, useSearchParams, type LoaderFunction } from 'react-router';

// Services and Utils
import { formatCurrency } from '~/utils';
import type { IWalletResponse } from '~/interfaces';
import { capitalize } from '~/utils/functions/textFormat';
import type { PaginationProps } from '~/interfaces/pagination';
import type { ITransactionResponse } from '~/interfaces/transaction';

// components
import { Button } from '~/components/ui/button';
import Pagination from '~/components/ui/pagination';
import { requireUserSession } from '~/services/auths.server';
import { getCustomerTransactions, getWalletByCustomerId } from '~/services/wallet.server';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '~/components/ui/dropdown-menu';

interface LoaderReturn {
    wallet: IWalletResponse;
    transactions: ITransactionResponse[];
    pagination: PaginationProps;
}

interface TransactionProps {
    loaderData: LoaderReturn;
}

export const loader: LoaderFunction = async ({ request }) => {
    const customerId = await requireUserSession(request);
    const url = new URL(request.url);
    const page = Number(url.searchParams.get("page") || 1);
    const take = 10;

    const wallet = await getWalletByCustomerId(customerId)

    const { transactions, pagination } = await getCustomerTransactions(customerId, page, take);
    return { wallet, transactions, pagination }
}

export default function WalletPage({ loaderData }: TransactionProps) {
    const { t } = useTranslation();
    const navigate = useNavigate()
    const navigation = useNavigation()
    const [searchParams] = useSearchParams();
    const {
        wallet,
        transactions,
        pagination
    } = loaderData;
    const isLoading = navigation.state === "loading";

    // For toast messages
    const toastMessage = searchParams.get("toastMessage");
    const toastType = searchParams.get("toastType");
    const showToast = (message: string, type: "success" | "error" | "warning" = "success", duration = 3000) => {
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
    const [activeTab, setActiveTab] = useState('All');

    const tabs = [
        { key: 'All', label: t('wallet.tabs.all') },
        { key: 'Approved', label: t('wallet.tabs.approved') },
        { key: 'Pending', label: t('wallet.tabs.pending') },
        { key: 'Failed', label: t('wallet.tabs.failed') }
    ];
    const filteredTransactions = transactions.filter(transaction => {
        const matchesTab = activeTab === 'All' ||
            (activeTab === 'Approved' && transaction.status === 'approved') ||
            (activeTab === 'Failed' && transaction.status === 'rejected') ||
            (activeTab === 'Pending' && transaction.status === 'pending');
        return matchesTab;
    });

    if (isLoading) {
        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 backdrop-blur-sm">
                <div className="flex items-center justify-center gap-2">
                    <Loader className="w-4 h-4 text-rose-500 animate-spin" />
                    <p className="text-rose-600">Loading....</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen p-2 sm:p-6">
            <div className="mx-auto space-y-2">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-4">
                    <div className="lg:col-span-3 bg-gradient-to-r from-rose-600 to-rose-400 rounded-2xl py-4 px-6 text-white relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
                        <div className="absolute bottom-0 left-0 w-20 h-20 bg-white/10 rounded-full -translate-x-10 translate-y-10"></div>
                        <div className="relative z-10 space-y-3">
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <Wallet size={24} />
                                    <span className="font-medium">{t('wallet.totalBalance')}</span>
                                </div>
                                <button
                                    onClick={() => setIsBalanceVisible(!isBalanceVisible)}
                                    className="p-1 hover:bg-white/20 rounded-lg transition-colors cursor-pointer"
                                >
                                    {isBalanceVisible ? <Eye size={20} /> : <EyeOff size={20} />}
                                </button>
                            </div>

                            <div className="flex items-start justify-start gap-6">
                                <div>
                                    <h2 className="text-lg">
                                        {isBalanceVisible ? formatCurrency(wallet.totalBalance) : '******'}
                                    </h2>
                                    <p className="text-white/80 text-sm">{t('wallet.availableBalance')}</p>
                                </div>

                                <div className="">
                                    <p className="text-lg">{isBalanceVisible ? formatCurrency(wallet.totalRecharge) : "******"}</p>
                                    <p className="text-white/80 text-sm">{t('wallet.totalRecharge')}</p>
                                </div>
                            </div>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate("/customer/wallet-topup")}
                        className="hidden sm:flex text-gray-500 rounded-lg p-6 items-center justify-center cursor-pointer space-x-2 border-2 border-dotted hover:border-rose-500 hover:text-black"
                    >
                        <PlusIcon className="h-5 w-5" />
                        <p className="text-md">{t('wallet.topUpWallet')}</p>
                    </button>
                    <button
                        onClick={() => navigate("/customer/wallet-topup")}
                        className="sm:hidden fixed bottom-18 right-4 bg-rose-500 hover:bg-rose-600 text-white rounded-lg py-2 px-4 shadow-lg flex items-center justify-center z-9999"
                    >
                        <PlusIcon className="h-4 w-4" /> {t('wallet.topUpWallet')}
                    </button>
                </div>

                <div className="bg-white rounded-md overflow-hidden">
                    <div className="p-4 border-b border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-md sm:text-md font-normal text-gray-600">{t('wallet.transactionHistory')}</h3>
                        </div>

                        <div className="space-y-4 flex flex-col sm:flex-row items-start justify-between">
                            <div className="flex gap-2 overflow-x-auto">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.key}
                                        onClick={() => setActiveTab(tab.key)}
                                        className={`cursor-pointer px-4 py-1 rounded-full whitespace-nowrap font-medium text-sm transition-colors ${activeTab === tab.key
                                            ? 'bg-rose-100 text-rose-600 border border-rose-300'
                                            : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                                            }`}
                                    >
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    <div className="divide-y divide-gray-100 cursor-pointer">
                        {filteredTransactions && filteredTransactions.length > 0 ? filteredTransactions.map((transaction, index: number) => (
                            <div key={transaction.id} className="p-4 hover:bg-gray-50 transition-colors group">
                                <div className="flex items-center justify-between">
                                    <div className="flex items-start justify-start space-x-8">
                                        <p className='text-gray-500'>{index + 1}</p>
                                        <div className="flex items-center gap-4">
                                            <div className={`hidden sm:block p-3 rounded-md ${transaction.status === 'approved' ? 'bg-green-100' : transaction.status === "rejected" ? 'bg-red-100' : "bg-orange-100"
                                                }`}>
                                                <DollarSign
                                                    size={18}
                                                    className={transaction.status === 'approved' ? 'text-green-600' : transaction.status === 'rejected' ? 'text-red-600' : "text-orange-600"}
                                                />
                                            </div>

                                            <div>
                                                <h4 className="font-medium text-gray-900">{capitalize(transaction.identifier)}</h4>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-xs text-gray-500">{transaction.createdAt.toDateString()}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center justify-center space-y-1 space-x-4 mt-2">
                                            <p className={`font-semibold ${transaction.identifier === 'recharge' ? 'text-green-600' : 'text-red-600'
                                                }`}>
                                                {transaction.identifier === 'recharge' ? '+' : transaction.identifier === "booking_hold" ? "" : '-'}{formatCurrency(transaction.amount)}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <p className={`text-center text-xs px-2 py-1 rounded-sm ${transaction.status === 'approved'
                                            ? 'bg-green-100 text-green-600'
                                            : transaction.status === 'rejected' ? "bg-red-100 text-red-600"
                                                : 'bg-orange-100 text-orange-600'
                                            }`}>
                                            {capitalize(transaction.status)}
                                        </p>

                                        <DropdownMenu>
                                            <DropdownMenuTrigger asChild>
                                                <Button variant="ghost" size="sm" className="text-gray-500 h-8 w-8 p-0">
                                                    <MoreVertical className="h-3 w-3" />
                                                    <span className="sr-only">More</span>
                                                </Button>
                                            </DropdownMenuTrigger>
                                            <DropdownMenuContent className="w-48" align="end" forceMount>
                                                <DropdownMenuItem className="text-gray-500 text-sm">
                                                    <Link to={`detail/${transaction.id}`} className="flex space-x-2 w-full">
                                                        <EyeIcon className="mr-2 h-3 w-3" />
                                                        <span>{t('wallet.menu.viewDetails')}</span>
                                                    </Link>
                                                </DropdownMenuItem>
                                                {transaction.status === "pending" &&
                                                    <DropdownMenuItem className="text-sm">
                                                        <Link to={`edit/${transaction.id}`} className="text-gray-500 flex space-x-2 w-full">
                                                            <FilePenLine className="mr-2 h-3 w-3" />
                                                            <span>{t('wallet.menu.edit')}</span>
                                                        </Link>
                                                    </DropdownMenuItem>
                                                }
                                                {transaction.status === "pending" &&
                                                    <DropdownMenuItem className="text-sm">
                                                        <Link to={`delete/${transaction.id}`} className="text-gray-500 flex space-x-2 w-full">
                                                            <Trash className="mr-2 h-3 w-3" />
                                                            <span>{t('wallet.menu.delete')}</span>
                                                        </Link>
                                                    </DropdownMenuItem>
                                                }
                                            </DropdownMenuContent>
                                        </DropdownMenu>
                                    </div>
                                </div>
                            </div>
                        )) :
                            <div className="p-8 text-center">
                                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                    <Search size={24} className="text-gray-400" />
                                </div>
                                <h4 className="text-gray-900 font-medium mb-2">{t('wallet.emptyTitle')}</h4>
                                <p className="text-gray-600 text-sm">{t('wallet.emptyMessage')}</p>
                            </div>
                        }
                        {pagination.totalPages > 1 &&
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
                        }
                    </div>
                </div>
            </div>
        </div>
    );
}
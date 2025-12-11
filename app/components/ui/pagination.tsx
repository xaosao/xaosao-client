import { Link } from "react-router";
import { Button } from "~/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    totalCount: number;
    limit: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    baseUrl: string;
    searchParams: URLSearchParams;
    pageParam?: string;
    tabFlag?: string;
}

export default function Pagination({
    currentPage,
    totalPages,
    hasNextPage,
    hasPreviousPage,
    baseUrl,
    searchParams,
    pageParam = "page", // Default to "page" for backward compatibility
    tabFlag, // Add this parameter
}: PaginationProps) {
    const createPageUrl = (page: number) => {
        const params = new URLSearchParams(searchParams);
        params.set(pageParam, page.toString()); // Use the dynamic pageParam

        // Add the tab-specific flag if provided
        if (tabFlag) {
            params.set(tabFlag, "true");
        }

        return `${baseUrl}?${params.toString()}`;
    };

    return (
        <div className="flex flex-col sm:flex-row items-center justify-center px-4 py-3 gap-2 mt-6">
            <div className="flex items-center space-x-2">
                {hasPreviousPage ? (
                    <Button variant="outline" size="sm" asChild>
                        <Link to={createPageUrl(currentPage - 1)}>
                            <ChevronLeft className="h-4 w-4" />
                        </Link>
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" disabled>
                        <ChevronLeft className="h-4 w-4" />
                    </Button>
                )}
                <span className="text-sm text-gray-700">
                    Page {currentPage} of {totalPages}
                </span>
                {hasNextPage ? (
                    <Button variant="outline" size="sm" asChild>
                        <Link to={createPageUrl(currentPage + 1)}>
                            <ChevronRight className="h-4 w-4" />
                        </Link>
                    </Button>
                ) : (
                    <Button variant="outline" size="sm" disabled>
                        <ChevronRight className="h-4 w-4" />
                    </Button>
                )}
            </div>
        </div>
    );
}
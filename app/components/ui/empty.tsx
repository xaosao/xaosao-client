import { SearchX } from "lucide-react";

interface EmptyPageProps {
    title: string;
    description: string;
}

export default function EmptyPage({ title, description }: EmptyPageProps) {
    return (
        <div className="text-center py-8">
            <SearchX className="h-8 w-8 text-gray-300 mx-auto mb-4 animate-pulse" />
            <p className="text-gray-500">{title}</p>
            <p className="text-sm text-gray-400">{description}</p>
        </div>
    );
}

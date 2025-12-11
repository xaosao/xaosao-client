import { Star } from "lucide-react";

interface RatingProps {
    value: number; // e.g. 1.5, 3, 4.5
    max?: number;  // default = 5
}

export default function Rating({ value, max = 5 }: RatingProps) {
    const stars = [];

    for (let i = 1; i <= max; i++) {
        if (value >= i) {
            // Full star
            stars.push(
                <Star key={i} className="w-4 h-4 text-rose-500 fill-rose-500" />
            );
        } else if (value >= i - 0.5) {
            // Half star (use mask)
            stars.push(
                <div key={i} className="relative w-4 h-4">
                    <Star className="w-4 h-4 text-rose-500 fill-rose-500 absolute left-0 top-0 clip-half" />
                    <Star className="w-4 h-4 text-gray-300 fill-gray-300" />
                </div>
            );
        } else {
            // Empty star
            stars.push(
                <Star key={i} className="w-4 h-4 text-gray-300 fill-gray-300" />
            );
        }
    }

    return <div className="flex space-x-1">{stars}</div>;
}

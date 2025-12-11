export const formatNumber = (num: any) => {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
};

export function formatDateMultiple(dateInput: Date | string): string {
    const inputDate = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    const today = new Date();

    // Normalize both dates
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfInput = new Date(inputDate.getFullYear(), inputDate.getMonth(), inputDate.getDate());

    const diffTime = startOfToday.getTime() - startOfInput.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        // Today → return time only
        return inputDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    }

    if (diffDays === 1) {
        return "Yesterday";
    }

    if (diffDays < 7) {
        // Day before yesterday or within the past week
        return inputDate.toLocaleDateString("en-US", { weekday: "long" });
    }

    // More than a week ago → use dd/mm/yyyy
    return inputDate.toLocaleDateString("en-GB"); // → 01/09/2025
}

// "Fri 11 Jul 2025 - 00:20"
export function formatDate(input: string): string {
    if (!input) return "";
    const date = new Date(input);
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "May",
        "Jun",
        "Jul",
        "Aug",
        "Sep",
        "Oct",
        "Nov",
        "Dec",
    ];

    const day = weekdays[date.getDay()];
    const dateNum = String(date.getDate()).padStart(2, "0");
    const month = months[date.getMonth()];
    const year = date.getFullYear();

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");

    return `${day} ${dateNum} ${month} ${year} - ${hours}:${minutes}`;
}

// Format Interests for insert to DB
export function parseInterests(raw: string | undefined | null): Record<string, string> | null {
    if (!raw) return null;

    try {
        const arr = JSON.parse(raw) as string[];

        if (!Array.isArray(arr)) return null;

        return arr.reduce<Record<string, string>>((acc, item, index) => {
            acc[(index + 1).toString()] = item;
            return acc;
        }, {});
    } catch (error) {
        console.error("Invalid interests input:", error);
        return null;
    }
}


// Part number string -> number:
export const parseFormattedNumber = (value: string | number | null | undefined): number | undefined => {
    if (value === null || value === undefined || value === '') {
        return undefined;
    }

    const rawValue = value.toString().replace(/,/g, '');
    const numValue = Number(rawValue);

    return isNaN(numValue) ? undefined : numValue;
};


// 
export function calculateDiscountPercent(
    priceShort: number,
    durationShort: number,
    priceLong: number,
    durationLong: number
): number {
    if (
        priceShort == null || durationShort == null ||
        priceLong == null || durationLong == null
    ) {
        return 0;
    }

    const dailyShort = priceShort / durationShort;
    const dailyLong = priceLong / durationLong;
    const discount = ((dailyShort - dailyLong) / dailyShort) * 100;
    return Math.round(discount);
}
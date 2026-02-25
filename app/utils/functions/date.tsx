// Give date time and it return birthday year
export function calculateAgeFromDOB(dob: string | Date): number {
    const birthDate = new Date(dob);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();

    const hasHadBirthdayThisYear =
        today.getMonth() > birthDate.getMonth() ||
        (today.getMonth() === birthDate.getMonth() &&
            today.getDate() >= birthDate.getDate());

    if (!hasHadBirthdayThisYear) {
        age -= 1;
    }

    return age;
}

// Format currency
export function formatCurrency(amount: number | undefined | null) {
    if (amount === undefined || amount === null) return "0 Kip";
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",") + " Kip";
}

export function formatCurrency1(amount: number | undefined | null) {
    if (amount === undefined || amount === null) return "0 Kip";
    return amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}


// Days calculate from dates:
export function calculateDayAmount(startDate?: string, endDate?: string | null): number {
    if (!startDate) return 0;

    const start = new Date(startDate);
    const end = endDate ? new Date(endDate) : start;

    if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;

    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    return diffDays > 0 ? diffDays : 1;
}

// Format date relative to now (e.g., "2 days ago", "1 month ago")
export function formatDateRelative(date: Date): string {
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInSeconds = Math.floor(diffInMs / 1000);
    const diffInMinutes = Math.floor(diffInSeconds / 60);
    const diffInHours = Math.floor(diffInMinutes / 60);
    const diffInDays = Math.floor(diffInHours / 24);
    const diffInWeeks = Math.floor(diffInDays / 7);
    const diffInMonths = Math.floor(diffInDays / 30);
    const diffInYears = Math.floor(diffInDays / 365);

    if (diffInSeconds < 60) {
        return 'Just now';
    } else if (diffInMinutes < 60) {
        return `${diffInMinutes} ${diffInMinutes === 1 ? 'minute' : 'minutes'} ago`;
    } else if (diffInHours < 24) {
        return `${diffInHours} ${diffInHours === 1 ? 'hour' : 'hours'} ago`;
    } else if (diffInDays < 7) {
        return `${diffInDays} ${diffInDays === 1 ? 'day' : 'days'} ago`;
    } else if (diffInWeeks < 4) {
        return `${diffInWeeks} ${diffInWeeks === 1 ? 'week' : 'weeks'} ago`;
    } else if (diffInMonths < 12) {
        return `${diffInMonths} ${diffInMonths === 1 ? 'month' : 'months'} ago`;
    } else {
        return `${diffInYears} ${diffInYears === 1 ? 'year' : 'years'} ago`;
    }
}

// Short relative time (e.g., "5m ago", "2h ago", "3d ago")
// Accepts optional t function from react-i18next for locale-aware output
export function getTimeAgo(dateStr: string, t?: (key: string, options?: Record<string, unknown>) => string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return t ? t("posts.timeAgo.justNow", { defaultValue: "just now" }) : "just now";
    if (minutes < 60) return t ? t("posts.timeAgo.minutes", { count: minutes, defaultValue: `${minutes}m ago` }) : `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return t ? t("posts.timeAgo.hours", { count: hours, defaultValue: `${hours}h ago` }) : `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return t ? t("posts.timeAgo.days", { count: days, defaultValue: `${days}d ago` }) : `${days}d ago`;
}
/**
 * Discover profile card — the 2-column grid tile.
 *
 * Deliberately shape-agnostic so one component serves both directions:
 * customers browsing models and models browsing customers. Callers map their
 * row into `DiscoverProfile` rather than this knowing about either table.
 */

import { Link } from "react-router";
import { Heart, MapPin, Star, BadgeCheck } from "lucide-react";

export interface DiscoverProfile {
  id: string;
  firstName: string | null;
  lastName?: string | null;
  /** Primary photo URL. */
  profile: string | null;
  /** Years. Callers derive this from dob. */
  age: number | null;
  /** Kilometres from the viewer, or null when either side has no location. */
  distance: number | null;
  rating?: number | null;
  vip?: boolean;
  /** Blur the photo when an admin has hidden this profile's images. */
  hidden?: boolean;
  /** Whether the viewer has already liked them. */
  liked?: boolean;
}

interface ProfileCardProps {
  profile: DiscoverProfile;
  /** Where tapping the card goes. */
  href: string;
  /** Omit to hide the like button (e.g. on the "I like" tab). */
  onToggleLike?: (id: string, nextLiked: boolean) => void;
  likePending?: boolean;
}

/** "965m" under a kilometre, "8.3km" above, "248km" when far. */
export function formatDistance(km: number | null): string | null {
  if (km == null || Number.isNaN(km)) return null;
  if (km < 1) return `${Math.max(1, Math.round(km * 1000))}m`;
  // Keep one decimal only when it carries information: "8.3km" but "12km".
  if (km < 100) {
    const rounded = Math.round(km * 10) / 10;
    return Number.isInteger(rounded) ? `${rounded}km` : `${rounded.toFixed(1)}km`;
  }
  return `${Math.round(km)}km`;
}

export function ProfileCard({
  profile,
  href,
  onToggleLike,
  likePending = false,
}: ProfileCardProps) {
  const name = profile.firstName?.trim() || "XaoSao";
  const distance = formatDistance(profile.distance);

  return (
    <div className="relative rounded-2xl overflow-hidden bg-gray-200 aspect-[3/4] shadow-sm">
      <Link to={href} prefetch="intent" className="block w-full h-full">
        {profile.profile ? (
          <img
            src={profile.profile}
            alt={name}
            loading="lazy"
            className={`w-full h-full object-cover transition-transform duration-300 ${
              profile.hidden ? "blur-md scale-110" : ""
            }`}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-rose-100 text-rose-400 text-3xl font-semibold">
            {name.charAt(0).toUpperCase()}
          </div>
        )}

        {/* Bottom scrim so white text stays legible over any photo. */}
        <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/75 via-black/35 to-transparent" />

        <div className="absolute inset-x-0 bottom-0 p-2.5 text-white">
          <p className="font-semibold text-sm leading-tight truncate drop-shadow flex items-center gap-1">
            <span className="truncate">
              {name}
              {profile.age != null ? `, ${profile.age}` : ""}
            </span>
            {profile.vip && (
              <BadgeCheck className="w-3.5 h-3.5 shrink-0 text-amber-300" />
            )}
          </p>

          <div className="flex items-center justify-between mt-1 text-[11px]">
            <span className="flex items-center gap-0.5 min-w-0 drop-shadow">
              {distance && (
                <>
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="truncate">{distance}</span>
                </>
              )}
            </span>
            <span className="flex items-center gap-0.5 shrink-0 drop-shadow">
              <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
              {(profile.rating ?? 0).toFixed(1)}
            </span>
          </div>
        </div>
      </Link>

      {onToggleLike && (
        <button
          type="button"
          disabled={likePending}
          aria-label={profile.liked ? "Unlike" : "Like"}
          aria-pressed={profile.liked}
          onClick={(event) => {
            // The button sits on top of the card's Link.
            event.preventDefault();
            event.stopPropagation();
            onToggleLike(profile.id, !profile.liked);
          }}
          className={`absolute top-2 right-2 w-9 h-9 rounded-full flex items-center justify-center backdrop-blur-sm transition-all duration-150 active:scale-90 disabled:opacity-60 ${
            profile.liked
              ? "bg-white text-rose-500"
              : "bg-black/25 text-white hover:bg-black/40"
          }`}
        >
          <Heart
            className={`w-4 h-4 ${profile.liked ? "fill-rose-500" : ""}`}
          />
        </button>
      )}
    </div>
  );
}

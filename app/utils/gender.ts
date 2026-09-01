/**
 * Who a viewer is allowed to see in Discover.
 *
 * The rule: a male viewer sees female profiles, a female viewer sees male.
 * Gender comes from the account — it is not a filter the user can change.
 *
 * `other` is deliberately permissive in both directions: those profiles are
 * visible to everyone, and a viewer whose gender is `other` sees everyone.
 * A strict binary rule would silently make those accounts non-functional —
 * they'd show an empty grid and never appear in anyone else's.
 *
 * Returns the list of genders to match, or `null` when no filter applies
 * (viewer is `other`, or their gender isn't set).
 */
export function visibleGendersFor(
  viewerGender: string | null | undefined
): string[] | null {
  switch ((viewerGender ?? "").trim().toLowerCase()) {
    case "male":
      return ["female", "other"];
    case "female":
      return ["male", "other"];
    default:
      // "other", empty, or anything unrecognised — show everyone rather than
      // stranding the account with a blank page.
      return null;
  }
}

/** Prisma `where` fragment for the rule above. Spread into a where clause. */
export function genderWhere(
  viewerGender: string | null | undefined
): { gender?: { in: string[] } } {
  const genders = visibleGendersFor(viewerGender);
  return genders ? { gender: { in: genders } } : {};
}

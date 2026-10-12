/** Ordered highest to lowest. Unknown ratings are never eligible. */
export function isRatingAllowed(
  scale: readonly string[],
  rating: string,
  maximum: string,
): boolean {
  const ratingIndex = scale.indexOf(rating);
  const maximumIndex = scale.indexOf(maximum);
  return ratingIndex >= 0 && maximumIndex >= 0 && ratingIndex >= maximumIndex;
}

export function allowedRatingLabels(
  scale: readonly string[],
  maximum: string,
): string[] {
  const index = scale.indexOf(maximum);
  return index < 0 ? [] : scale.slice(index);
}

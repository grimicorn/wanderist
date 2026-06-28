import type { ComputedRef, MaybeRef, Ref } from "vue";
import type { Entry } from "~/stores/entries";
import type { Trip } from "~/stores/trips";

export type FeedTab = "Timeline" | "By trip" | "Photos";

export const FEED_TABS: FeedTab[] = ["Timeline", "By trip", "Photos"];

export interface DayGroup {
  key: string;
  label: string;
  entries: Entry[];
}

export interface TripGroup {
  key: string;
  trip: Trip | null;
  tripName: string;
  entries: Entry[];
}

function utcDateKey(dateString: string): string {
  const date = new Date(dateString);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function utcDateLabel(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

function entryDateSource(entry: Entry): string {
  return entry.occurredAt ?? entry.createdAt;
}

/**
 * Groups a flat list of entries by calendar day (UTC), preserving server sort
 * order within each group. Group order reflects the input order.
 */
export function groupEntriesByDay(entries: Entry[]): DayGroup[] {
  const groupMap = new Map<
    string,
    { key: string; label: string; entries: Entry[] }
  >();

  for (const entry of entries) {
    const dateSource = entryDateSource(entry);
    const key = utcDateKey(dateSource);

    if (!groupMap.has(key)) {
      groupMap.set(key, { key, label: utcDateLabel(dateSource), entries: [] });
    }

    groupMap.get(key)!.entries.push(entry);
  }

  return Array.from(groupMap.values());
}

function resolveMatchingTrip(tripId: string, trips: Trip[]): Trip | undefined {
  return trips.find((tripItem) => tripItem.id === tripId);
}

function buildTripGroupKey(trip: Trip | null): string {
  return trip?.id ?? "no-trip";
}

/**
 * Groups a flat list of entries by their associated trip. Entries without a
 * trip (or with a tripId that doesn't match any known trip) are placed in a
 * "No trip" group at the end.
 */
export function groupEntriesByTrip(
  entries: Entry[],
  trips: Trip[],
): TripGroup[] {
  const tripMap = new Map<string, { trip: Trip; entries: Entry[] }>();
  const noTripEntries: Entry[] = [];

  for (const entry of entries) {
    if (!entry.tripId) {
      noTripEntries.push(entry);
      continue;
    }

    const knownTrip = resolveMatchingTrip(entry.tripId, trips);

    if (!knownTrip) {
      noTripEntries.push(entry);
      continue;
    }

    if (!tripMap.has(entry.tripId)) {
      tripMap.set(entry.tripId, { trip: knownTrip, entries: [] });
    }

    tripMap.get(entry.tripId)!.entries.push(entry);
  }

  const tripGroups: TripGroup[] = Array.from(tripMap.values()).map((group) => ({
    key: buildTripGroupKey(group.trip),
    trip: group.trip,
    tripName: group.trip.name,
    entries: group.entries,
  }));

  if (noTripEntries.length > 0) {
    tripGroups.push({
      key: "no-trip",
      trip: null,
      tripName: "No trip",
      entries: noTripEntries,
    });
  }

  return tripGroups;
}

/**
 * Filters entries to those that have at least one photo attached.
 */
export function filterEntriesWithPhotos(entries: Entry[]): Entry[] {
  return entries.filter((entry) => entry.photos.length > 0);
}

export interface UseJournalFeedReturn {
  activeTab: Ref<FeedTab>;
  dayGroups: ComputedRef<DayGroup[]>;
  tripGroups: ComputedRef<TripGroup[]>;
  photoEntries: ComputedRef<Entry[]>;
}

/**
 * Encapsulates tab state and derived groupings for the journal feed.
 * Accepts the reactive entries list and trips list from their respective stores.
 */
export function useJournalFeed(
  entriesList: Ref<Entry[]>,
  tripsList: MaybeRef<Trip[]>,
): UseJournalFeedReturn {
  const activeTab = ref<FeedTab>("Timeline");

  const resolvedTrips = isRef(tripsList) ? tripsList : ref(tripsList);

  const dayGroups = computed<DayGroup[]>(() =>
    groupEntriesByDay(entriesList.value),
  );

  const tripGroups = computed<TripGroup[]>(() =>
    groupEntriesByTrip(entriesList.value, resolvedTrips.value),
  );

  const photoEntries = computed<Entry[]>(() =>
    filterEntriesWithPhotos(entriesList.value),
  );

  return { activeTab, dayGroups, tripGroups, photoEntries };
}

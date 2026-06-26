<template>
  <div class="content content--wide">
    <div class="trips-head">
      <div>
        <div class="label">// 9 trips · 117 places · 48.2k miles</div>
        <h1>Your trips</h1>
        <p>One ongoing, two on the calendar, six in the books.</p>
      </div>
      <button class="btn btn--outline">
        <AppIcon name="route" :size="15" />
        plan a new route
      </button>
    </div>

    <!-- Featured active trip -->
    <div class="feature">
      <NuxtLink class="feature__cover ph" to="/trips/1">
        <div class="topo" />
        <span class="feature__badge tag tag--ongoing">● ongoing</span>
      </NuxtLink>
      <div class="feature__body">
        <div class="label">// active trip · day 6 of 9</div>
        <h2 style="margin-top: 8px">Iceland, the ring road</h2>
        <div class="feature__route">
          <span class="stop"><span class="dot" />Reykjavík</span>
          <AppIcon name="arrow-right" :size="13" class="arr" />
          <span class="stop"><span class="dot" />Vík</span>
          <AppIcon name="arrow-right" :size="13" class="arr" />
          <span class="stop"><span class="dot" />Jökulsárlón</span>
          <AppIcon name="arrow-right" :size="13" class="arr" />
          <span class="stop" style="color: var(--muted)">+4 stops</span>
        </div>
        <div class="feature__prog">
          <div class="progress">
            <span style="width: 64%" />
          </div>
          <div
            class="hstack"
            style="
              justify-content: space-between;
              font-size: 11px;
              color: var(--muted);
              margin-top: 6px;
            "
          >
            <span>64% logged · 4 of 7 stops</span>
            <span>3 days left</span>
          </div>
        </div>
        <div class="feature__stats">
          <div>
            <div class="n">4</div>
            <div class="l">entries</div>
          </div>
          <div>
            <div class="n">61</div>
            <div class="l">photos</div>
          </div>
          <div>
            <div class="n">892</div>
            <div class="l">miles</div>
          </div>
          <div style="margin-left: auto; align-self: center">
            <NuxtLink class="btn btn--primary btn--sm" to="/trips/1">
              open trip
              <AppIcon name="arrow-right" :size="14" />
            </NuxtLink>
          </div>
        </div>
      </div>
    </div>

    <!-- Toolbar -->
    <div class="trip-toolbar">
      <div class="seg-tabs">
        <button
          v-for="tab in tabs"
          :key="tab"
          :class="{ 'is-active': activeTab === tab }"
          @click="activeTab = tab"
        >
          {{ tab }}
        </button>
      </div>
      <span class="spacer" />
      <span class="label label--plain" style="font-size: 10px">sort</span>
      <button class="btn btn--outline btn--sm">
        <AppIcon name="sliders" :size="14" />
        recent first
      </button>
    </div>

    <!-- Grid -->
    <div class="trip-grid">
      <NuxtLink
        v-for="trip in filteredTrips"
        :key="trip.id"
        class="tcard"
        to="/trips/1"
      >
        <div class="tcard__cover ph">
          <div class="topo" />
          <span class="tcard__status" :class="tripStatusClass(trip.status)">{{
            tripStatusLabel(trip)
          }}</span>
          <button class="tcard__save" aria-label="Save" @click.prevent>
            <AppIcon name="bookmark" :size="15" />
          </button>
        </div>
        <div class="tcard__body">
          <div class="tcard__name">{{ trip.name }}</div>
          <div class="tcard__dates">{{ trip.dates }}</div>
          <div class="tcard__foot">
            <span class="m"
              ><AppIcon name="pin" :size="13" /> {{ trip.stops }} stops</span
            >
            <span class="m"
              ><AppIcon name="journal" :size="13" /> {{ trip.entries }}</span
            >
            <span v-if="trip.photos" class="m"
              ><AppIcon name="image" :size="13" /> {{ trip.photos }}</span
            >
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: "app", middleware: "auth" });
useHead({ title: "Wanderist — Trips" });

type TripStatus = "ongoing" | "upcoming" | "past";

interface Trip {
  id: string;
  name: string;
  dates: string;
  stops: number;
  entries: string;
  photos?: string;
  status: TripStatus;
  year?: string;
}

const STATUS_CLASSES: Record<TripStatus, string> = {
  ongoing: "tag tag--ongoing",
  upcoming: "tag tag--upcoming",
  past: "tag tag--past",
};

const tabs = ["All", "Ongoing", "Upcoming", "Past"] as const;
const activeTab = ref<(typeof tabs)[number]>("All");

const trips: Trip[] = [
  {
    id: "2",
    name: "Portugal, coast to coast",
    dates: "Jun 24 – Jul 3, 2026 · 9 days",
    stops: 5,
    entries: "0",
    status: "upcoming",
  },
  {
    id: "3",
    name: "Norway in winter",
    dates: "Feb 2027 · planning",
    stops: 3,
    entries: "draft",
    status: "upcoming",
  },
  {
    id: "4",
    name: "Japan, north to south",
    dates: "Oct 4 – Oct 22, 2025 · 18 days",
    stops: 9,
    entries: "9",
    photos: "240",
    status: "past",
    year: "2025",
  },
  {
    id: "5",
    name: "Marrakech & the Atlas",
    dates: "Mar 12 – Mar 19, 2025 · 7 days",
    stops: 4,
    entries: "2",
    photos: "88",
    status: "past",
    year: "2025",
  },
  {
    id: "6",
    name: "Sydney & the east coast",
    dates: "Nov 2 – Nov 16, 2024 · 14 days",
    stops: 8,
    entries: "4",
    photos: "156",
    status: "past",
    year: "2024",
  },
  {
    id: "7",
    name: "A weekend in London",
    dates: "Jun 7 – Jun 9, 2024 · 3 days",
    stops: 2,
    entries: "3",
    photos: "31",
    status: "past",
    year: "2024",
  },
];

const filteredTrips = computed(() => {
  if (activeTab.value === "All") {
    return trips;
  }
  return trips.filter((trip) => trip.status === activeTab.value.toLowerCase());
});

function tripStatusClass(status: TripStatus) {
  return STATUS_CLASSES[status];
}

function tripStatusLabel(trip: Trip) {
  return trip.year ?? trip.status;
}
</script>

<style scoped>
.trips-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 18px;
  margin-bottom: 22px;
  flex-wrap: wrap;
}
.trips-head h1 {
  font-size: 28px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin-top: 10px;
}
.trips-head p {
  margin: 6px 0 0;
  font-size: 12.5px;
  color: var(--muted);
}

.feature {
  display: grid;
  grid-template-columns: 300px 1fr;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
  background: var(--surface);
  margin-bottom: 26px;
}
.feature__cover {
  position: relative;
  min-height: 220px;
}
.feature__cover .topo {
  opacity: 0.5;
}
.feature__badge {
  position: absolute;
  top: 14px;
  left: 14px;
  z-index: 2;
}
.feature__body {
  padding: 24px 26px;
  display: flex;
  flex-direction: column;
}
.feature__body h2 {
  font-size: 23px;
  font-weight: 700;
  letter-spacing: -0.02em;
}
.feature__route {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  margin: 14px 0;
  font-size: 12px;
  color: var(--ink-2);
}
.feature__route .stop {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.feature__route .stop .dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--accent);
}
.feature__route .arr {
  color: var(--faint);
}
.feature__stats {
  display: flex;
  gap: 28px;
  padding: 16px 0;
  border-top: 1px solid var(--line);
  margin-top: auto;
}
.feature__stats .n {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 700;
}
.feature__stats .l {
  font-size: 10.5px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.06em;
}
.feature__prog {
  margin: 4px 0 18px;
}

.trip-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
  flex-wrap: wrap;
}
.trip-toolbar .spacer {
  flex: 1;
}

.trip-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.tcard {
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  transition:
    border-color 0.14s,
    transform 0.14s,
    box-shadow 0.14s;
}
.tcard:hover {
  border-color: var(--accent-line);
  transform: translateY(-3px);
  box-shadow: var(--shadow);
}
.tcard__cover {
  position: relative;
  height: 132px;
}
.tcard__cover .topo {
  opacity: 0.45;
}
.tcard__status {
  position: absolute;
  top: 11px;
  left: 11px;
  z-index: 2;
}
.tcard__save {
  position: absolute;
  top: 9px;
  right: 9px;
  z-index: 2;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--surface) 80%, transparent);
  backdrop-filter: blur(6px);
  border: 1px solid var(--line);
  display: grid;
  place-items: center;
  color: var(--ink-2);
}
.tcard__save:hover {
  color: var(--accent-ink);
}
.tcard__body {
  padding: 14px 16px 16px;
  display: flex;
  flex-direction: column;
  flex: 1;
}
.tcard__name {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
}
.tcard__dates {
  font-size: 11.5px;
  color: var(--muted);
  margin-top: 3px;
}
.tcard__foot {
  display: flex;
  gap: 16px;
  margin-top: 14px;
  padding-top: 12px;
  border-top: 1px solid var(--line);
}
.tcard__foot .m {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11px;
  color: var(--ink-2);
}
.tcard__prog {
  height: 5px;
  border-radius: 99px;
  background: var(--line);
  overflow: hidden;
  margin-top: 13px;
}
.tcard__prog span {
  display: block;
  height: 100%;
  background: var(--accent);
  border-radius: 99px;
}

.tag--ongoing {
  border-color: var(--success-ink);
  color: var(--success-ink);
  background: var(--success-weak);
}
.tag--upcoming {
  border-color: var(--info-ink);
  color: var(--info-ink);
  background: var(--info-weak);
}
.tag--past {
  border-color: var(--line-strong);
  color: var(--muted);
}

@media (max-width: 1040px) {
  .trip-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .feature {
    grid-template-columns: 1fr;
  }
  .feature__cover {
    min-height: 160px;
  }
}
@media (max-width: 680px) {
  .trip-grid {
    grid-template-columns: 1fr;
  }
}
</style>

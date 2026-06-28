<template>
  <div class="content content--wide">
    <AppTopbar title="Explore" crumb="Discover">
      <button class="icon-btn" aria-label="Search">
        <AppIcon name="search" :size="18" />
      </button>
      <button class="icon-btn" aria-label="Alerts">
        <AppIcon name="bell" :size="18" />
      </button>
      <button class="btn btn--primary btn--sm">
        <AppIcon name="plus" :size="14" />
        new entry
      </button>
    </AppTopbar>

    <!-- Hero search -->
    <div class="xhero">
      <div class="topo" />
      <div class="xhero__in">
        <div class="label">// discover</div>
        <h1>Where to next?</h1>
        <p>
          Curated destinations, guides from travelers you follow, and places
          trending across Wanderist.
        </p>
        <label class="xsearch">
          <AppIcon name="search" :size="18" />
          <input
            v-model="heroSearch"
            placeholder="Search a city, country, or kind of place…"
          />
          <span class="kbd">⌘K</span>
        </label>
        <div class="xchips">
          <span
            v-for="chip in searchChips"
            :key="chip"
            class="xchip"
            @click="heroSearch = chip"
            >{{ chip }}</span
          >
        </div>
      </div>
    </div>

    <!-- Featured destinations -->
    <section class="xsec">
      <div class="sec-head">
        <div>
          <div class="label">// featured this week</div>
          <h2>Destinations to dream on</h2>
        </div>
        <a class="btn btn--ghost btn--sm" href="#">
          see all
          <AppIcon name="arrow-right" :size="14" />
        </a>
      </div>
      <div class="feat-row">
        <a v-for="dest in featured" :key="dest.title" class="feat ph" href="#">
          <div class="topo" />
          <div class="feat__veil" />
          <button class="feat__save" aria-label="Save">
            <AppIcon name="bookmark" :size="15" />
          </button>
          <div class="feat__in">
            <div class="feat__kicker">{{ dest.kicker }}</div>
            <div class="feat__title">{{ dest.title }}</div>
            <div class="feat__meta">
              <span
                ><AppIcon name="route" :size="12" /> {{ dest.days }} days</span
              >
              <span
                ><AppIcon name="pin" :size="12" /> {{ dest.stops }} stops</span
              >
              <span><AppIcon name="heart" :size="12" /> {{ dest.likes }}</span>
            </div>
          </div>
        </a>
      </div>
    </section>

    <!-- Trending places -->
    <section class="xsec">
      <div class="sec-head">
        <div>
          <div class="label">// trending places</div>
          <h2>Pinned a lot this month</h2>
        </div>
      </div>
      <div class="filter-row">
        <button
          v-for="filter in placeFilters"
          :key="filter"
          class="fbtn"
          :class="{ 'is-active': activeFilter === filter }"
          @click="activeFilter = filter"
        >
          {{ filter }}
        </button>
      </div>
      <div class="place-grid">
        <a
          v-for="place in trendingPlaces"
          :key="place.name"
          class="pcard"
          href="#"
        >
          <div class="pcard__cover ph">
            <div class="topo" />
            <span class="pcard__tag tag tag--accent">{{ place.tag }}</span>
          </div>
          <div class="pcard__body">
            <div class="pcard__name">{{ place.name }}</div>
            <div class="pcard__loc">
              <AppIcon name="pin" :size="11" />
              {{ place.location }}
            </div>
            <div class="pcard__foot">
              <span class="saves">
                <AppIcon name="bookmark" :size="12" />
                {{ place.saves }} saves
              </span>
              <span>
                <AppIcon
                  name="trending"
                  :size="12"
                  style="vertical-align: -2px"
                />
                {{ place.trend }}
              </span>
            </div>
          </div>
        </a>
      </div>
    </section>

    <!-- Guides + People -->
    <section class="xsec">
      <div class="two-col">
        <!-- Guides -->
        <div>
          <div class="sec-head">
            <div>
              <div class="label">// guides</div>
              <h2>Reads for your next trip</h2>
            </div>
          </div>
          <a v-for="guide in guides" :key="guide.title" class="guide" href="#">
            <div class="guide__thumb ph">
              <div class="topo" style="opacity: 0.4" />
            </div>
            <div>
              <div class="guide__name">{{ guide.title }}</div>
              <div class="guide__by">{{ guide.by }}</div>
              <div class="guide__meta">
                <span class="m">
                  <AppIcon name="clock" :size="12" />
                  {{ guide.readTime }} min read
                </span>
                <span class="m">
                  <AppIcon name="heart" :size="12" />
                  {{ guide.likes }}
                </span>
              </div>
            </div>
          </a>
        </div>

        <!-- People -->
        <div>
          <div class="sec-head">
            <div>
              <div class="label">// people</div>
              <h2>Travelers to follow</h2>
            </div>
          </div>
          <AppAlert
            v-if="followError"
            intent="error"
            :message="followError"
            :dismissible="true"
          />
          <div class="card card--pad" style="padding: 16px 18px">
            <div v-for="person in people" :key="person.handle" class="person">
              <span class="person__av">
                <AppIcon name="user" :size="19" />
              </span>
              <div class="person__name">
                <b>{{ person.name }}</b>
                <span
                  >{{ person.handle }} · {{ person.location }} ·
                  {{ person.places }} places</span
                >
              </div>
              <button
                class="btn btn--sm"
                :class="person.following ? 'btn--primary' : 'btn--outline'"
                :disabled="person.pending"
                @click="toggleFollow(person.userId)"
              >
                <template v-if="person.following">
                  <AppIcon name="check" :size="14" />
                  following
                </template>
                <template v-else>follow</template>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from "vue";

definePageMeta({ layout: "app", middleware: "auth" });
useHead({ title: "Wanderist — Explore" });

const heroSearch = ref("");
const activeFilter = ref("All");

const searchChips = [
  "Cold-water swims",
  "Northern lights",
  "Slow coastlines",
  "Food cities",
  "Off-season Europe",
];
const placeFilters = ["All", "Nature", "Cities", "Coast", "Food", "Culture"];

const featured = [
  {
    kicker: "Iceland · summer",
    title: "The ring road, slowly",
    days: 9,
    stops: 7,
    likes: "2.4k",
  },
  {
    kicker: "Portugal · coast",
    title: "Lisbon to the Algarve",
    days: 7,
    stops: 5,
    likes: "1.8k",
  },
  {
    kicker: "Japan · autumn",
    title: "North to south by rail",
    days: 18,
    stops: 9,
    likes: "3.1k",
  },
];

const trendingPlaces = [
  {
    name: "Reynisfjara",
    location: "Vík, Iceland",
    tag: "nature",
    saves: "4.2k",
    trend: "+18%",
  },
  {
    name: "Alfama",
    location: "Lisbon, Portugal",
    tag: "city",
    saves: "3.7k",
    trend: "+24%",
  },
  {
    name: "Diamond Beach",
    location: "Jökulsárlón, Iceland",
    tag: "coast",
    saves: "2.9k",
    trend: "+12%",
  },
  {
    name: "Tsukiji outer market",
    location: "Tokyo, Japan",
    tag: "food",
    saves: "5.1k",
    trend: "+9%",
  },
];

const guides = [
  {
    title: "The cold-water swimming guide to Iceland",
    by: "by @elsa_far · 14 spots mapped",
    readTime: 8,
    likes: 412,
  },
  {
    title: "Lisbon on foot: a hill-by-hill walk",
    by: "by @marco.travels · 9 stops",
    readTime: 6,
    likes: 287,
  },
  {
    title: "Eating Tokyo for a week without a plan",
    by: "by @yuki · 21 spots mapped",
    readTime: 11,
    likes: 638,
  },
];

// Placeholder people list. The userId field maps to the Clerk user ID stored in
// the DB and is used by the follow API. In a real implementation this list would
// come from an API response that includes user IDs.
const PEOPLE = [
  {
    userId: "user_placeholder_elsa",
    name: "Elsa Farþegi",
    handle: "@elsa_far",
    location: "Reykjavík",
    places: 84,
  },
  {
    userId: "user_placeholder_marco",
    name: "Marco Reis",
    handle: "@marco.travels",
    location: "Lisbon",
    places: 2100,
  },
  {
    userId: "user_placeholder_yuki",
    name: "Yuki Tanaka",
    handle: "@yuki",
    location: "Tokyo",
    places: 510,
  },
  {
    userId: "user_placeholder_maya",
    name: "Maya Rambles",
    handle: "@mayarambles",
    location: "Oslo",
    places: 332,
  },
];

const {
  fetchFollowing,
  toggleFollow,
  isFollowing,
  isPending,
  error: followError,
} = useFollows();

// Derive follow state from the composable so it stays in sync with persisted state.
const people = computed(() =>
  PEOPLE.map((person) => ({
    ...person,
    following: isFollowing(person.userId),
    pending: isPending(person.userId),
  })),
);

onMounted(async () => {
  await fetchFollowing();
});
</script>

<style scoped>
.xhero {
  position: relative;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
  padding: 38px 34px;
  margin-bottom: 26px;
  background: var(--surface);
}
.xhero .topo {
  opacity: 0.18;
}
.xhero__in {
  position: relative;
  z-index: 2;
  max-width: 640px;
}
.xhero h1 {
  font-size: 30px;
  font-weight: 700;
  letter-spacing: -0.02em;
  margin: 10px 0 6px;
}
.xhero p {
  font-size: 13px;
  color: var(--ink-2);
  margin: 0 0 20px;
}
.xsearch {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 13px 16px;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius);
  background: var(--surface-2);
  box-shadow: var(--shadow);
}
.xsearch :deep(.ico) {
  width: 18px;
  height: 18px;
  color: var(--muted);
}
.xsearch input {
  flex: 1;
  border: none;
  background: none;
  outline: none;
  font-size: 14px;
  color: var(--ink);
}
.xsearch input::placeholder {
  color: var(--faint);
}
.xchips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 14px;
}
.xchip {
  font-size: 11.5px;
  padding: 6px 12px;
  border: 1px solid var(--line-strong);
  border-radius: 99px;
  color: var(--ink-2);
  background: var(--surface-2);
  cursor: pointer;
}
.xchip:hover {
  border-color: var(--accent);
  color: var(--accent-ink);
}

.sec-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  margin: 0 0 16px;
}
.sec-head h2 {
  font-family: var(--font-display);
  font-size: 20px;
}
.sec-head .label {
  margin-bottom: 6px;
}
section.xsec {
  margin-bottom: 30px;
}

.feat-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
}
.feat {
  position: relative;
  height: 250px;
  border-radius: var(--radius);
  overflow: hidden;
  border: 1px solid var(--line);
  display: flex;
  align-items: flex-end;
  text-decoration: none;
}
.feat .topo {
  opacity: 0.5;
}
.feat__veil {
  position: absolute;
  inset: 0;
  background: linear-gradient(to top, rgba(20, 17, 14, 0.8), transparent 65%);
  z-index: 1;
}
.feat__in {
  position: relative;
  z-index: 2;
  padding: 18px 20px;
  color: #fff;
  width: 100%;
}
.feat__kicker {
  font-size: 10.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.8);
}
.feat__title {
  font-family: var(--font-display);
  font-size: 19px;
  font-weight: 700;
  margin: 4px 0 8px;
}
.feat__meta {
  display: flex;
  gap: 14px;
  font-size: 11.5px;
  color: rgba(255, 255, 255, 0.82);
}
.feat__meta span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.feat__meta :deep(.ico) {
  width: 12px;
  height: 12px;
}
.feat__save {
  position: absolute;
  top: 12px;
  right: 12px;
  z-index: 3;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.15);
  backdrop-filter: blur(6px);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: grid;
  place-items: center;
  color: #fff;
}

.filter-row {
  display: flex;
  gap: 7px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}
.fbtn {
  font-size: 12px;
  padding: 7px 13px;
  border: 1px solid var(--line-strong);
  border-radius: 99px;
  color: var(--ink-2);
  background: var(--surface);
  cursor: pointer;
}
.fbtn.is-active {
  background: var(--accent-weak);
  color: var(--accent-ink);
  border-color: var(--accent-line);
  font-weight: 600;
}
.place-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}
.pcard {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  overflow: hidden;
  transition:
    border-color 0.14s,
    transform 0.14s;
  text-decoration: none;
  display: block;
}
.pcard:hover {
  border-color: var(--accent-line);
  transform: translateY(-3px);
}
.pcard__cover {
  height: 110px;
  position: relative;
}
.pcard__cover .topo {
  opacity: 0.45;
}
.pcard__tag {
  position: absolute;
  top: 9px;
  left: 9px;
  z-index: 2;
}
.pcard__body {
  padding: 12px 13px 14px;
}
.pcard__name {
  font-family: var(--font-display);
  font-size: 14.5px;
  font-weight: 600;
}
.pcard__loc {
  font-size: 11px;
  color: var(--muted);
  margin-top: 2px;
  display: flex;
  align-items: center;
  gap: 5px;
}
.pcard__foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 11px;
  font-size: 11px;
  color: var(--faint);
}
.pcard__foot .saves {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.two-col {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 24px;
  align-items: start;
}
.guide {
  display: flex;
  gap: 14px;
  padding: 13px;
  border: 1px solid var(--line);
  border-radius: var(--radius);
  background: var(--surface);
  margin-bottom: 12px;
  transition: border-color 0.14s;
  text-decoration: none;
}
.guide:hover {
  border-color: var(--accent-line);
}
.guide__thumb {
  width: 92px;
  height: 72px;
  flex: none;
  border-radius: var(--radius-sm);
}
.guide__name {
  font-family: var(--font-display);
  font-size: 14.5px;
  font-weight: 600;
}
.guide__by {
  font-size: 11px;
  color: var(--muted);
  margin-top: 3px;
}
.guide__meta {
  margin-top: auto;
  display: flex;
  gap: 12px;
  font-size: 11px;
  color: var(--faint);
  padding-top: 8px;
}
.guide__meta .m {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.person {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 11px 0;
  border-bottom: 1px dashed var(--line);
}
.person:last-child {
  border-bottom: none;
}
.person__av {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: var(--accent-weak);
  color: var(--accent-ink);
  display: grid;
  place-items: center;
  flex: none;
}
.person__name b {
  font-size: 13px;
}
.person__name span {
  font-size: 11px;
  color: var(--muted);
  display: block;
}
.person .btn {
  margin-left: auto;
}

@media (max-width: 1100px) {
  .place-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .feat-row {
    grid-template-columns: 1fr 1fr;
  }
  .two-col {
    grid-template-columns: 1fr;
  }
}
@media (max-width: 680px) {
  .feat-row {
    grid-template-columns: 1fr;
  }
  .place-grid {
    grid-template-columns: 1fr;
  }
}
</style>

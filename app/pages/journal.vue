<template>
  <div class="content">
    <AppTopbar title="Journal" crumb="Home">
      <div class="feed-tabs">
        <button
          v-for="tab in feedTabs"
          :key="tab"
          :class="{ 'is-active': activeTab === tab }"
          @click="activeTab = tab"
        >
          {{ tab }}
        </button>
      </div>
      <button class="btn btn--primary btn--sm">
        <AppIcon name="plus" :size="14" />
        new entry
      </button>
    </AppTopbar>

    <div class="jcols">
      <!-- Feed -->
      <div class="feed">
        <!-- Compose bar -->
        <div class="compose">
          <span class="compose__av">
            <AppIcon name="user" :size="18" />
          </span>
          <input placeholder="Write an entry, or drop today's photos…" />
          <div class="acts">
            <button class="icon-btn" aria-label="Add photo">
              <AppIcon name="image" :size="18" />
            </button>
            <button class="icon-btn" aria-label="Add location">
              <AppIcon name="pin" :size="18" />
            </button>
          </div>
        </div>

        <div class="day-div"><span class="label">// today · iceland</span></div>

        <!-- Post 1 -->
        <article class="post">
          <div class="post__head">
            <span class="post__av">
              <AppIcon name="user" :size="18" />
            </span>
            <div class="post__who">
              <b>Dan H.</b>
              <div class="post__meta">
                <AppIcon name="pin" :size="11" />
                Reykjavík, Iceland · 4:12am
              </div>
            </div>
            <button
              class="post__menu icon-btn"
              style="border: none"
              aria-label="More"
            >
              <AppIcon
                name="chevron"
                :size="16"
                style="transform: rotate(90deg)"
              />
            </button>
          </div>
          <div class="post__media grid">
            <div class="ph">
              <div class="topo" style="opacity: 0.4" />
              <span class="ph__tag">harbor · 01</span>
            </div>
            <div class="ph"><div class="topo" style="opacity: 0.4" /></div>
            <div class="ph">
              <div class="topo" style="opacity: 0.4" />
              <span class="more-badge">+4</span>
            </div>
          </div>
          <div class="post__body">
            <div class="post__actions">
              <button
                class="like"
                :class="{ liked: posts[0].liked }"
                @click="toggleLike(0)"
              >
                <AppIcon name="heart" :size="17" />
                <span class="cnt">{{ posts[0].likes }}</span>
              </button>
              <button>
                <AppIcon name="journal" :size="17" />
                3
              </button>
              <button style="margin-left: auto">
                <AppIcon name="star" :size="17" />
              </button>
            </div>
            <h3 class="post__title">Harbor at 4am</h3>
            <p class="post__text">
              Cold morning, the whole harbor still asleep. Found coffee at a
              window and watched the boats come in. The light up here doesn't
              behave like light anywhere else.
            </p>
            <div class="tag-row">
              <span class="tag tag--accent">iceland</span>
              <span class="tag">ring road</span>
              <span class="tag">day 6</span>
            </div>
          </div>
        </article>

        <div class="day-div">
          <span class="label">// jun 8 · portugal</span>
        </div>

        <!-- Post 2 -->
        <article class="post">
          <div class="post__head">
            <span class="post__av">
              <AppIcon name="user" :size="18" />
            </span>
            <div class="post__who">
              <b>Dan H.</b>
              <div class="post__meta">
                <AppIcon name="pin" :size="11" />
                Lisbon, Portugal · 6:40pm
              </div>
            </div>
            <button
              class="post__menu icon-btn"
              style="border: none"
              aria-label="More"
            >
              <AppIcon
                name="chevron"
                :size="16"
                style="transform: rotate(90deg)"
              />
            </button>
          </div>
          <div class="post__media single">
            <div class="ph">
              <div class="topo" style="opacity: 0.4" />
              <span class="ph__tag">viewpoint · alfama</span>
            </div>
          </div>
          <div class="post__body">
            <div class="post__actions">
              <button
                class="like"
                :class="{ liked: posts[1].liked }"
                @click="toggleLike(1)"
              >
                <AppIcon name="heart" :size="17" />
                <span class="cnt">{{ posts[1].likes }}</span>
              </button>
              <button>
                <AppIcon name="journal" :size="17" />
                7
              </button>
              <button style="margin-left: auto">
                <AppIcon name="star" :size="17" />
              </button>
            </div>
            <h3 class="post__title">Tram 28, again</h3>
            <p class="post__text">
              Took the long way through Alfama. Pastéis first, then up to the
              viewpoint I keep coming back to. Imported these straight from
              Instagram.
            </p>
            <div class="tag-row">
              <span class="tag tag--accent">portugal</span>
              <span class="tag">
                <AppIcon
                  name="instagram"
                  :size="11"
                  style="vertical-align: -1px"
                />
                imported
              </span>
              <span class="tag">12 photos</span>
            </div>
          </div>
        </article>
      </div>

      <!-- Right rail -->
      <aside class="rail">
        <div class="rail-card">
          <h4 class="display">
            Active trip
            <NuxtLink
              class="label label--plain"
              to="/home"
              style="font-size: 10px"
              >stats</NuxtLink
            >
          </h4>
          <div
            class="trip-hero ph"
            style="
              height: 90px;
              border-radius: 8px;
              position: relative;
              overflow: hidden;
            "
          >
            <div class="topo" style="opacity: 0.5" />
          </div>
          <div
            style="
              font-family: var(--font-display);
              font-weight: 600;
              font-size: 15px;
              margin-top: 10px;
            "
          >
            Iceland, the ring road
          </div>
          <div
            class="progress"
            style="
              height: 6px;
              border-radius: 99px;
              background: var(--line);
              overflow: hidden;
              margin: 10px 0 6px;
            "
          >
            <span
              style="
                display: block;
                height: 100%;
                width: 64%;
                background: var(--accent);
                border-radius: 99px;
              "
            />
          </div>
          <div
            class="hstack"
            style="
              justify-content: space-between;
              font-size: 11px;
              color: var(--muted);
            "
          >
            <span>day 6 of 9</span>
            <span>4 entries</span>
          </div>
        </div>

        <div class="rail-card">
          <h4 class="display">Trips</h4>
          <div v-for="trip in sideTrips" :key="trip.name" class="trip-pill">
            <span class="trip-pill__sw" style="background: var(--bg-tint)">
              <span class="topo" style="opacity: 0.6" />
            </span>
            <div>
              <div class="trip-pill__name">{{ trip.name }}</div>
              <div class="trip-pill__sub">{{ trip.sub }}</div>
            </div>
          </div>
        </div>

        <div class="rail-card onthisday">
          <h4 class="display">On this day · 2024</h4>
          <div class="ph">
            <div class="topo" style="opacity: 0.4" />
            <span class="ph__tag">sydney · 2024</span>
          </div>
          <div class="post__meta" style="font-size: 11px">
            <AppIcon name="pin" :size="11" />
            Sydney, Australia — two years ago today.
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

definePageMeta({ layout: "app", middleware: "auth" });
useHead({ title: "Wanderist — Journal" });

const feedTabs = ["Timeline", "By trip", "Photos"];
const activeTab = ref("Timeline");

const posts = ref([
  { likes: 24, liked: false },
  { likes: 41, liked: true },
]);

const sideTrips = [
  { name: "Iceland 2026", sub: "4 entries · ongoing" },
  { name: "Portugal 2026", sub: "6 entries" },
  { name: "Japan 2025", sub: "9 entries" },
];

function toggleLike(index: number) {
  const post = posts.value[index];
  post.liked = !post.liked;
  post.likes += post.liked ? 1 : -1;
}
</script>

<style scoped>
.jcols {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 296px;
  gap: 28px;
  align-items: start;
  max-width: 960px;
  margin: 0 auto;
}
.feed {
  display: flex;
  flex-direction: column;
  gap: 18px;
  min-width: 0;
}

.compose {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 14px 16px;
  display: flex;
  align-items: center;
  gap: 12px;
}
.compose__av {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: var(--accent-weak);
  color: var(--accent-ink);
  display: grid;
  place-items: center;
  flex: none;
}
.compose input {
  flex: 1;
  border: none;
  background: none;
  outline: none;
  font-size: 13.5px;
  color: var(--ink);
}
.compose input::placeholder {
  color: var(--faint);
}
.compose .acts {
  display: flex;
  gap: 6px;
}

.feed-tabs {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 99px;
  align-self: flex-start;
}
.feed-tabs button {
  border: none;
  background: none;
  padding: 6px 14px;
  border-radius: 99px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--muted);
}
.feed-tabs button.is-active {
  background: var(--accent-weak);
  color: var(--accent-ink);
  font-weight: 600;
}

.post {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  overflow: hidden;
}
.post__head {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 14px 16px;
}
.post__av {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  background: var(--accent-weak);
  color: var(--accent-ink);
  display: grid;
  place-items: center;
  flex: none;
}
.post__who b {
  font-size: 13px;
}
.post__meta {
  font-size: 11px;
  color: var(--muted);
  display: flex;
  align-items: center;
  gap: 6px;
}
.post__meta :deep(.ico) {
  width: 11px;
  height: 11px;
  color: var(--accent);
}
.post__menu {
  margin-left: auto;
  color: var(--muted);
}
.post__media {
  position: relative;
}
.post__media.single {
  aspect-ratio: 3/2;
}
.post__media.grid {
  display: grid;
  grid-template-columns: 2fr 1fr;
  grid-template-rows: 1fr 1fr;
  gap: 3px;
  aspect-ratio: 3/2;
}
.post__media :deep(.ph) {
  border-radius: 0;
  border-left: none;
  border-right: none;
}
.post__media.single :deep(.ph) {
  width: 100%;
  height: 100%;
  border: none;
}
.post__media.grid :deep(.ph):first-child {
  grid-row: span 2;
}
.more-badge {
  position: absolute;
  right: 8px;
  bottom: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  font-size: 11px;
  padding: 3px 9px;
  border-radius: 99px;
}
.post__body {
  padding: 14px 16px 16px;
}
.post__actions {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 12px;
}
.post__actions button {
  display: flex;
  align-items: center;
  gap: 6px;
  border: none;
  background: none;
  color: var(--ink-2);
  font-size: 12.5px;
  cursor: pointer;
}
.post__actions button :deep(.ico) {
  width: 17px;
  height: 17px;
}
.post__actions button.liked {
  color: var(--accent-ink);
}
.post__title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 5px;
}
.post__text {
  font-size: 13px;
  color: var(--ink-2);
  line-height: 1.6;
  margin: 0 0 10px;
}

.day-div {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 2px;
}
.day-div .label {
  white-space: nowrap;
}
.day-div::after {
  content: "";
  flex: 1;
  height: 1px;
  background: var(--line);
}

.rail {
  position: sticky;
  top: 92px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.rail-card {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius);
  padding: 16px;
}
.rail-card h4 {
  font-size: 13px;
  margin-bottom: 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.trip-pill {
  display: flex;
  align-items: center;
  gap: 11px;
  padding: 8px;
  border-radius: var(--radius-sm);
  cursor: pointer;
}
.trip-pill:hover {
  background: var(--accent-weak);
}
.trip-pill__sw {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  flex: none;
  position: relative;
  overflow: hidden;
}
.trip-pill__name {
  font-size: 12.5px;
  font-weight: 500;
}
.trip-pill__sub {
  font-size: 10.5px;
  color: var(--muted);
}
.onthisday :deep(.ph) {
  height: 96px;
  margin-bottom: 10px;
}

@media (max-width: 880px) {
  .jcols {
    grid-template-columns: 1fr;
  }
  .rail {
    position: static;
  }
}
</style>

<template>
  <div class="content content--wide">
    <AppTopbar title="Dashboard" crumb="Home">
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

    <!-- Greeting -->
    <div class="hello">
      <div>
        <div class="label">// evening · fri, jun 14</div>
        <h1 style="margin-top:10px">Welcome back, <b>Dan.</b></h1>
        <p>You've been to 9 countries. Iceland is your most-journaled trip this year.</p>
      </div>
      <NuxtLink class="btn btn--outline" to="/map">
        <AppIcon name="map" :size="16" />
        open the map
      </NuxtLink>
    </div>

    <!-- Import alert -->
    <div class="alert alert--info" style="margin-bottom:22px">
      <AppIcon name="instagram" :size="18" class="alert__ico" />
      <div class="alert__body">
        <p class="alert__title">12 geotagged photos from Lisbon are ready</p>
        <p class="alert__msg">Import them straight into your Portugal trip.</p>
      </div>
      <div class="hstack gap-8" style="margin-left:auto">
        <NuxtLink class="btn btn--ghost btn--sm" to="/settings#connections">manage</NuxtLink>
        <button class="btn btn--primary btn--sm">import all</button>
      </div>
    </div>

    <!-- Stats -->
    <div class="stats">
      <div v-for="stat in stats" :key="stat.label" class="stat">
        <div class="stat__ico">
          <AppIcon :name="stat.icon" :size="16" />
        </div>
        <div class="stat__num">{{ stat.value }}</div>
        <div class="stat__lbl">{{ stat.label }}</div>
        <div v-if="stat.delta" class="stat__delta">{{ stat.delta }}</div>
      </div>
    </div>

    <!-- Map + current trip -->
    <div class="cols">
      <div class="map-card">
        <div class="map-card__bar">
          <span class="label label--plain" style="color:var(--ink)">Your world</span>
          <span class="grow" />
          <span class="tag">117 pins</span>
          <NuxtLink class="btn btn--ghost btn--sm" to="/map">
            expand
            <AppIcon name="arrow-right" :size="14" />
          </NuxtLink>
        </div>
        <div class="map-body">
          <div class="map-panel">
            <div class="topo" style="opacity:.4" />
          </div>
          <NuxtLink
            v-for="pin in mapPins"
            :key="pin.tip"
            class="pin-abs"
            :class="{ sm: pin.sm }"
            to="/journal"
            :style="{ left: pin.left, top: pin.top }"
          >
            <AppIcon name="pin" :size="pin.sm ? 17 : 24" class="pin" />
            <span class="pin-tip">{{ pin.tip }}</span>
          </NuxtLink>
        </div>
      </div>

      <div class="trip-card">
        <div class="label">// current trip</div>
        <div class="trip-hero ph" style="margin-top:12px">
          <div class="topo" style="opacity:.5" />
          <span class="ph__tag" style="position:relative;z-index:2">cover · iceland</span>
        </div>
        <h3 style="font-size:18px">Iceland, the ring road</h3>
        <p class="muted" style="font-size:12px;margin:4px 0 0">Day 6 of 9 · 4 of 7 stops logged</p>
        <div class="progress"><span style="width:64%" /></div>
        <div class="hstack" style="justify-content:space-between;font-size:11px;color:var(--muted)">
          <span>64% logged</span>
          <span>3 days left</span>
        </div>
        <div class="nextstop">
          <AppIcon name="pin" :size="18" style="color:var(--accent)" />
          <div>
            <div style="font-size:12.5px;font-weight:600">Next: Jökulsárlón</div>
            <div style="font-size:11px;color:var(--muted)">glacier lagoon · 1h 40m drive</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent entries -->
    <div class="feed-head">
      <div>
        <div class="label">// recent entries</div>
        <h2 class="display" style="font-size:20px;margin-top:8px">From the journal</h2>
      </div>
      <NuxtLink class="btn btn--ghost btn--sm" to="/journal">
        view all
        <AppIcon name="arrow-right" :size="14" />
      </NuxtLink>
    </div>

    <div class="entries">
      <NuxtLink
        v-for="entry in recentEntries"
        :key="entry.title"
        class="entry"
        to="/journal"
      >
        <div class="entry__thumb ph">
          <div class="topo" style="opacity:.4" />
        </div>
        <div class="entry__meta">
          <div class="entry__loc">
            <AppIcon name="pin" :size="11" />
            {{ entry.location }}
          </div>
          <div class="entry__title">{{ entry.title }}</div>
          <p class="entry__excerpt">{{ entry.excerpt }}</p>
          <div class="entry__foot">
            <span>
              <AppIcon name="calendar" :size="11" style="vertical-align:-2px" />
              {{ entry.date }}
            </span>
            <span>
              <AppIcon name="image" :size="11" style="vertical-align:-2px" />
              {{ entry.photos }}
            </span>
            <span>
              <AppIcon name="heart" :size="11" style="vertical-align:-2px" />
              {{ entry.likes }}
            </span>
          </div>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Wanderist — Home' })

const stats = [
  { icon: 'pin', value: '117', label: 'Places pinned', delta: '+6 wk' },
  { icon: 'globe', value: '9', label: 'Countries', delta: null },
  { icon: 'plane', value: '48.2k', label: 'Miles logged', delta: '+1.4k' },
  { icon: 'flag', value: '14', label: 'Day streak', delta: null },
]

const mapPins = [
  { tip: 'Reykjavík · 4 entries', left: '24%', top: '40%', sm: false },
  { tip: 'London', left: '47%', top: '34%', sm: true },
  { tip: 'Lisbon · 12 photos', left: '45%', top: '52%', sm: true },
  { tip: 'Tokyo', left: '72%', top: '44%', sm: true },
  { tip: 'Sydney', left: '82%', top: '66%', sm: true },
  { tip: 'Marrakech', left: '30%', top: '62%', sm: true },
]

const recentEntries = [
  {
    location: 'Reykjavík, IS',
    title: 'Harbor at 4am',
    excerpt: 'Cold morning, the whole harbor still asleep. Found coffee at a window and watched the boats.',
    date: 'Jun 12',
    photos: 6,
    likes: 24,
  },
  {
    location: 'Lisbon, PT',
    title: 'Tram 28, again',
    excerpt: 'Took the long way through Alfama. Pastéis, then a viewpoint I keep coming back to.',
    date: 'Jun 8',
    photos: 12,
    likes: 41,
  },
]
</script>

<style scoped>
.hello { display: flex; align-items: flex-end; justify-content: space-between; gap: 18px; margin-bottom: 22px; flex-wrap: wrap; }
.hello h1 { font-size: 30px; font-weight: 700; letter-spacing: -.02em; }
.hello h1 b { color: var(--accent-ink); }
.hello p { margin: 6px 0 0; font-size: 12.5px; color: var(--muted); }

.stats { display: grid; grid-template-columns: repeat(4,1fr); gap: 14px; margin-bottom: 22px; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px 17px; position: relative; overflow: hidden; }
.stat__ico { width: 30px; height: 30px; border-radius: 8px; background: var(--accent-weak); color: var(--accent-ink); display: grid; place-items: center; margin-bottom: 12px; }
.stat__num { font-family: var(--font-display); font-size: 30px; font-weight: 700; letter-spacing: -.02em; line-height: 1; }
.stat__lbl { font-size: 11px; color: var(--muted); letter-spacing: .06em; text-transform: uppercase; margin-top: 6px; }
.stat__delta { position: absolute; top: 16px; right: 16px; font-size: 11px; color: var(--success-ink); }

.cols { display: grid; grid-template-columns: 1.5fr 1fr; gap: 16px; margin-bottom: 22px; }
.map-card { position: relative; border-radius: var(--radius); overflow: hidden; border: 1px solid var(--line); min-height: 340px; display:flex; flex-direction:column; }
.map-card__bar { display:flex; align-items:center; gap:10px; padding: 13px 16px; border-bottom:1px solid var(--line); background: var(--surface); z-index:2; }
.grow { flex:1; }
.map-body { position: relative; flex:1; }
.map-body .map-panel { position:absolute; inset:0; border:none; border-radius:0; }
.pin-abs { position:absolute; transform: translate(-50%,-100%); cursor:pointer; }
.pin-abs:hover { z-index: 5; }
.pin-tip { position:absolute; bottom: 100%; left:50%; transform: translateX(-50%); margin-bottom:4px; white-space:nowrap; background: var(--ink); color: var(--bg); font-size:10.5px; padding:3px 7px; border-radius:5px; opacity:0; transition:opacity .15s; pointer-events:none; }
.pin-abs:hover .pin-tip { opacity:1; }

.trip-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 18px; display:flex; flex-direction:column; }
.trip-hero { height: 120px; border-radius: var(--radius-sm); position: relative; overflow: hidden; margin-bottom: 14px; }
.progress { height: 6px; border-radius: 99px; background: var(--line); overflow: hidden; margin: 10px 0 6px; }
.progress span { display:block; height:100%; background: var(--accent); border-radius:99px; }
.nextstop { display:flex; align-items:center; gap:10px; margin-top:auto; padding-top:14px; border-top:1px solid var(--line); }

.feed-head { display:flex; align-items:center; justify-content:space-between; margin-bottom: 14px; }
.entries { display: grid; grid-template-columns: repeat(2,1fr); gap: 14px; }
.entry { display:flex; gap:14px; background: var(--surface); border:1px solid var(--line); border-radius: var(--radius); padding: 12px; transition: border-color .14s, transform .14s; text-decoration: none; color: inherit; }
.entry:hover { border-color: var(--accent-line); transform: translateY(-2px); }
.entry__thumb { width: 88px; height: 88px; flex:none; border-radius: var(--radius-sm); }
.entry__meta { min-width:0; display:flex; flex-direction:column; }
.entry__loc { font-size:10.5px; letter-spacing:.08em; text-transform:uppercase; color: var(--accent-ink); display:flex; align-items:center; gap:5px; }
.entry__title { font-family: var(--font-display); font-weight:600; font-size:15px; margin:5px 0 4px; }
.entry__excerpt { font-size:11.5px; color: var(--muted); line-height:1.5; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; }
.entry__foot { margin-top:auto; display:flex; align-items:center; gap:12px; font-size:11px; color: var(--faint); }

@media (max-width: 1040px) { .stats { grid-template-columns: repeat(2,1fr); } .cols { grid-template-columns:1fr; } .entries { grid-template-columns:1fr; } }
</style>

<template>
  <div v-if="open" class="drawer is-open" role="dialog" aria-label="New entry">
    <div class="drawer__scrim" @click="$emit('close')" />
    <aside class="drawer__panel">
      <header class="drawer__head">
        <div>
          <div class="label">// new entry</div>
          <h3 class="display" style="font-size:18px;margin-top:6px">Capture a moment</h3>
        </div>
        <button class="icon-btn" aria-label="Close" @click="$emit('close')">
          <AppIcon name="x" :size="18" />
        </button>
      </header>

      <div class="drawer__body">
        <!-- Photo upload -->
        <div class="dropzone">
          <div class="dropzone__grid">
            <div class="ph dz-thumb">
              <div class="topo" />
            </div>
            <div class="ph dz-thumb">
              <div class="topo" />
            </div>
            <button class="dz-add">
              <AppIcon name="camera" :size="17" />
              <span>add photos</span>
            </button>
          </div>
          <p class="dropzone__hint">
            Drag photos here, or import geotagged shots from
            <AppIcon name="instagram" :size="13" style="vertical-align:-2px" />
            Instagram.
          </p>
        </div>

        <!-- Title -->
        <div class="field">
          <label class="field__label">Title</label>
          <div class="field__wrap">
            <input
              v-model="form.title"
              class="field__input"
              placeholder="Give this moment a name…"
            />
          </div>
        </div>

        <!-- Entry text -->
        <div class="field">
          <label class="field__label">Entry</label>
          <textarea
            v-model="form.body"
            class="field__input"
            rows="5"
            placeholder="What happened? What did it feel like?"
          />
        </div>

        <!-- Location -->
        <div class="field">
          <label class="field__label">Location</label>
          <div class="field__wrap">
            <input v-model="form.location" class="field__input" />
            <span class="field__icon"><AppIcon name="pin" :size="16" /></span>
          </div>
          <div class="chip-suggest">
            <span
              v-for="suggestion in locationSuggestions"
              :key="suggestion"
              class="chip"
              @click="form.location = suggestion"
            >{{ suggestion }}</span>
          </div>
        </div>

        <!-- Trip -->
        <div class="field">
          <label class="field__label">Trip</label>
          <div class="pill-pick">
            <button
              v-for="trip in trips"
              :key="trip"
              class="pick"
              :class="{ 'is-active': form.trip === trip }"
              @click="form.trip = trip"
            >{{ trip }}</button>
          </div>
        </div>

        <!-- Date & Visibility row -->
        <div class="drawer__row">
          <div class="field" style="margin:0">
            <label class="field__label">Date</label>
            <div class="field__wrap">
              <input v-model="form.date" class="field__input" />
              <span class="field__icon"><AppIcon name="calendar" :size="16" /></span>
            </div>
          </div>
          <div class="field" style="margin:0">
            <label class="field__label">Visibility</label>
            <div class="segmented seg-sm">
              <button
                :class="{ 'is-active': form.visibility === 'private' }"
                @click="form.visibility = 'private'"
              >Private</button>
              <button
                :class="{ 'is-active': form.visibility === 'public' }"
                @click="form.visibility = 'public'"
              >Public</button>
            </div>
          </div>
        </div>

        <!-- Tags -->
        <div class="field">
          <label class="field__label">Tags</label>
          <div class="tags-input">
            <span
              v-for="tag in form.tags"
              :key="tag"
              class="tag tag--accent"
            >
              {{ tag }}
              <button class="tag-x" style="background:none;border:none;padding:0;cursor:pointer;font-size:10px" @click="removeTag(tag)">×</button>
            </span>
            <input v-model="tagInput" placeholder="add tag…" @keydown.enter.prevent="addTag" />
          </div>
        </div>

        <!-- Weather -->
        <div class="field" style="margin-bottom:4px">
          <label class="field__label">
            Weather
            <span class="muted" style="text-transform:none;letter-spacing:0">optional</span>
          </label>
          <div class="pill-pick">
            <button
              v-for="weather in weatherOptions"
              :key="weather.value"
              class="pick"
              :class="{ 'is-active': form.weather === weather.value }"
              @click="form.weather = weather.value"
            >
              <AppIcon :name="weather.icon" :size="14" />
              {{ weather.label }}
            </button>
          </div>
        </div>
      </div>

      <footer class="drawer__foot">
        <button class="btn btn--ghost btn--sm" @click="saveDraft">save draft</button>
        <span style="flex:1" />
        <button class="btn btn--outline btn--sm" @click="$emit('close')">cancel</button>
        <button class="btn btn--primary btn--sm" @click="publish">
          <AppIcon name="check" :size="14" />
          publish
        </button>
      </footer>
    </aside>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

defineProps<{ open: boolean }>()
defineEmits<{ close: [] }>()

const locationSuggestions = ['Old Harbour', 'Hallgrímskirkja', 'Sun Voyager']
const trips = ['Iceland, ring road', 'Portugal 2026', 'None']

const weatherOptions = [
  { value: 'clear', label: 'Clear', icon: 'sun' },
  { value: 'overcast', label: 'Overcast', icon: 'cloud' },
  { value: 'windy', label: 'Windy', icon: 'wind' },
]

const form = ref({
  title: '',
  body: '',
  location: 'Reykjavík, Iceland',
  trip: 'Iceland, ring road',
  date: 'Jun 14, 2026',
  visibility: 'private' as 'private' | 'public',
  tags: ['iceland', 'ring road'] as string[],
  weather: 'overcast',
})

const tagInput = ref('')

function addTag() {
  const value = tagInput.value.trim()
  if (value && !form.value.tags.includes(value)) {
    form.value.tags = [...form.value.tags, value]
  }
  tagInput.value = ''
}

function removeTag(tag: string) {
  form.value.tags = form.value.tags.filter((t) => t !== tag)
}

function saveDraft() {
  // draft saved — handled by parent or future persistence layer
}

function publish() {
  // entry published — handled by parent or future API layer
}
</script>

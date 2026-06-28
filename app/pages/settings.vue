<template>
  <div>
    <AppTopbar title="Account" crumb="Settings">
      <button class="btn btn--ghost btn--sm">discard</button>
      <button
        class="btn btn--primary btn--sm"
        :disabled="!!loadError"
        @click="saveChanges"
      >
        <AppIcon name="check" :size="14" />
        save changes
      </button>
    </AppTopbar>

    <div class="content content--wide">
      <div v-if="loadError" class="load-error">
        <AppAlert intent="error" :title="loadError" />
      </div>
      <div class="set-layout">
        <!-- Side nav -->
        <nav class="set-nav">
          <a
            v-for="section in sections"
            :key="section.id"
            :href="`#${section.id}`"
            :class="{ 'is-active': activeSection === section.id }"
            @click.prevent="scrollTo(section.id)"
          >
            {{ section.label }}
          </a>
        </nav>

        <div ref="sectionsRef" class="set-sections">
          <!-- Profile -->
          <section id="profile" class="sect">
            <div class="sect__head">
              <div class="label">// 01 — profile</div>
              <h3 class="display" style="margin-top: 8px">Profile</h3>
              <p>
                How you show up across Wanderist and your public traveler
                profile.
              </p>
            </div>
            <div class="avatar-row">
              <div class="avatar">
                <div class="topo" />
                <AppIcon
                  name="user"
                  :size="30"
                  style="position: relative; z-index: 2"
                />
              </div>
              <div class="vstack gap-8">
                <div class="hstack gap-8" style="flex-wrap: wrap">
                  <button class="btn btn--outline btn--sm">
                    <AppIcon name="camera" :size="14" />
                    upload photo
                  </button>
                  <button class="btn btn--ghost btn--sm">remove</button>
                </div>
                <span class="muted" style="font-size: 11px"
                  >JPG or PNG · up to 4MB · square works best</span
                >
              </div>
            </div>
            <div class="row">
              <InputText v-model="profile.name" label="Display name" required />
              <InputText
                v-model="profile.handle"
                label="Public handle"
                state="success"
              />
            </div>
            <InputText
              v-model="profile.homeBase"
              label="Home base"
              icon="pin"
            />
            <InputTextarea
              v-model="profile.bio"
              label="Bio"
              placeholder="A line about where you've been, or where you're headed."
              :rows="3"
            />
          </section>

          <!-- Account -->
          <section id="account" class="sect">
            <div class="sect__head">
              <div class="label">// 02 — account</div>
              <h3 class="display" style="margin-top: 8px">
                Email &amp; password
              </h3>
              <p>Used to sign in and for important trip notifications.</p>
            </div>
            <InputText
              v-model="profile.email"
              label="Email address"
              icon="mail"
              state="success"
              hint="Verified"
            />
            <div class="opt-row">
              <div class="lbl">
                <b>Password</b>
                <p>Last changed 3 months ago.</p>
              </div>
              <button
                class="btn btn--outline btn--sm"
                @click="showPasswordFields = !showPasswordFields"
              >
                <AppIcon name="lock" :size="14" />
                change password
              </button>
            </div>
            <div v-if="showPasswordFields" style="margin-top: 14px">
              <div class="row">
                <InputText
                  label="New password"
                  type="password"
                  placeholder="••••••••"
                />
                <InputText
                  label="Confirm"
                  type="password"
                  placeholder="••••••••"
                />
              </div>
            </div>
          </section>

          <!-- Connections -->
          <section id="connections" class="sect">
            <div class="sect__head">
              <div class="label">// 03 — connections</div>
              <h3 class="display" style="margin-top: 8px">
                Connected accounts
              </h3>
              <p>Pull in geotagged photos and sign in faster.</p>
            </div>

            <div v-if="connectionsLoadError" style="margin-bottom: 12px">
              <AppAlert intent="error" :title="connectionsLoadError" />
            </div>
            <div v-if="instagramConnectionSuccess" style="margin-bottom: 12px">
              <AppAlert intent="success" title="Instagram connected" />
            </div>
            <div v-if="instagramConnectionError" style="margin-bottom: 12px">
              <AppAlert
                intent="error"
                title="Instagram connection failed or was cancelled"
              />
            </div>
            <div v-if="connectionsActionError" style="margin-bottom: 12px">
              <AppAlert intent="error" :title="connectionsActionError" />
            </div>
            <div v-if="importResult" style="margin-bottom: 12px">
              <AppAlert
                :intent="importResult.errors.length > 0 ? 'error' : 'success'"
                :title="
                  importResult.errors.length > 0
                    ? `Import finished with ${importResult.errors.length} error${importResult.errors.length === 1 ? '' : 's'}`
                    : `Imported ${importResult.imported} photo${importResult.imported === 1 ? '' : 's'}`
                "
              />
            </div>

            <!-- Instagram -->
            <div class="conn">
              <div class="conn__logo">
                <AppIcon name="instagram" :size="20" />
              </div>
              <div class="conn__meta">
                <b>Instagram</b>
                <p>Auto-import geotagged photos into your entries.</p>
              </div>
              <div class="right">
                <template v-if="connections.instagram.connected">
                  <button
                    class="btn btn--outline btn--sm"
                    :disabled="connectionsLoading"
                    @click="handleImportInstagram"
                  >
                    <AppIcon name="download" :size="14" />
                    import photos
                  </button>
                  <button
                    class="btn btn--ghost btn--sm"
                    :disabled="connectionsLoading"
                    @click="handleDisconnectInstagram"
                  >
                    disconnect
                  </button>
                </template>
                <template v-else>
                  <button
                    class="btn btn--primary btn--sm"
                    :disabled="connectionsLoading"
                    @click="handleConnectInstagram"
                  >
                    <AppIcon name="plus" :size="14" />
                    connect
                  </button>
                </template>
              </div>
            </div>

            <!-- Google -->
            <div class="conn">
              <div class="conn__logo"><AppIcon name="google" :size="20" /></div>
              <div class="conn__meta">
                <b>Google</b>
                <p v-if="connections.google.emailAddress">
                  Signed in as {{ connections.google.emailAddress }}
                </p>
                <p v-else>Sign in faster with your Google account.</p>
              </div>
              <div class="right">
                <template v-if="connections.google.connected">
                  <span class="status-dot">connected</span>
                  <button
                    class="btn btn--ghost btn--sm"
                    :disabled="connectionsLoading"
                    @click="handleDisconnectGoogle"
                  >
                    disconnect
                  </button>
                </template>
                <template v-else>
                  <span class="muted" style="font-size: 12px"
                    >not connected</span
                  >
                </template>
              </div>
            </div>
          </section>

          <!-- Prefs -->
          <section id="prefs" class="sect">
            <div class="sect__head">
              <div class="label">// 04 — preferences</div>
              <h3 class="display" style="margin-top: 8px">Units &amp; map</h3>
              <p>How distances and your map look across the app.</p>
            </div>
            <div class="opt-row">
              <div class="lbl">
                <b>Distance units</b>
                <p>Used for trip stats and mileage.</p>
              </div>
              <div class="segmented">
                <button
                  :class="{ 'is-active': units === 'mi' }"
                  @click="units = 'mi'"
                >
                  miles
                </button>
                <button
                  :class="{ 'is-active': units === 'km' }"
                  @click="units = 'km'"
                >
                  kilometres
                </button>
              </div>
            </div>
            <div class="opt-row" style="display: block; border-bottom: none">
              <div class="lbl" style="margin-bottom: 12px">
                <b>Default map style</b>
                <p>The base layer for your map and pins.</p>
              </div>
              <div class="map-style-grid">
                <label
                  v-for="style in mapStyles"
                  :key="style.value"
                  class="map-style"
                  :class="{ 'is-active': mapStyle === style.value }"
                  @click="mapStyle = style.value"
                >
                  <input
                    type="radio"
                    name="mapstyle"
                    :checked="mapStyle === style.value"
                  />
                  <div class="map-style__pv" :class="`pv-${style.value}`" />
                  <div class="map-style__l">
                    {{ style.label }}
                    <AppIcon
                      v-if="mapStyle === style.value"
                      name="check"
                      :size="14"
                      class="check"
                    />
                  </div>
                </label>
              </div>
            </div>
          </section>

          <!-- Privacy -->
          <section id="privacy" class="sect">
            <div class="sect__head">
              <div class="label">// 05 — privacy</div>
              <h3 class="display" style="margin-top: 8px">Privacy</h3>
              <p>Decide what's public and how precise your locations are.</p>
            </div>
            <div class="opt-row">
              <div class="lbl">
                <b>Public traveler profile</b>
                <p>
                  Let anyone view your published trips at wanderist.app/@danh.
                </p>
              </div>
              <label class="switch"
                ><input v-model="privacy.publicProfile" type="checkbox" /><span
              /></label>
            </div>
            <div class="opt-row">
              <div class="lbl">
                <b>Precise pin location</b>
                <p>
                  Off rounds pins to the nearest city so your home isn't
                  exposed.
                </p>
              </div>
              <label class="switch"
                ><input
                  v-model="privacy.preciseLocation"
                  type="checkbox" /><span
              /></label>
            </div>
            <div class="opt-row">
              <div class="lbl">
                <b>Show me on Explore</b>
                <p>
                  Appear in the community Explore feed for nearby travelers.
                </p>
              </div>
              <label class="switch"
                ><input v-model="privacy.showOnExplore" type="checkbox" /><span
              /></label>
            </div>
          </section>

          <!-- Danger -->
          <section id="danger" class="sect danger">
            <div class="sect__head">
              <div class="label" style="color: var(--error-ink)">
                // danger zone
              </div>
              <h3 class="display" style="margin-top: 8px">Delete account</h3>
              <p>
                Permanently remove your account, trips, entries and photos. This
                can't be undone.
              </p>
            </div>
            <div class="opt-row" style="border-bottom: none">
              <div class="lbl">
                <b>Delete this account</b>
                <p>
                  You'll have 14 days to change your mind before data is erased.
                </p>
              </div>
              <button
                class="btn btn--sm"
                style="background: var(--error); color: #fff"
                @click="deleteModal = true"
              >
                <AppIcon name="trash" :size="14" />
                delete account
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- Error toast -->
    <div v-if="showErrorBar" class="saved-bar show">
      <AppAlert intent="error" :title="saveError ?? 'Failed to save'" />
    </div>

    <!-- Saved toast -->
    <div v-else class="saved-bar" :class="{ show: showSaved }">
      <AppAlert intent="success" title="Settings saved" />
    </div>

    <!-- Delete modal -->
    <div
      class="modal-scrim"
      :class="{ 'is-open': deleteModal }"
      @click.self="deleteModal = false"
    >
      <div class="modal">
        <div class="label" style="color: var(--error-ink); margin-bottom: 10px">
          // confirm deletion
        </div>
        <h3 class="display">Delete your account?</h3>
        <p>
          This removes <b>117 places</b>, <b>9 trips</b> and all photos. Type
          <b>DELETE</b> to confirm.
        </p>
        <InputText v-model="deleteConfirm" placeholder="DELETE" />
        <div
          class="hstack gap-12"
          style="justify-content: flex-end; margin-top: 8px"
        >
          <button class="btn btn--ghost" @click="deleteModal = false">
            cancel
          </button>
          <button
            class="btn"
            :disabled="deleteConfirm !== 'DELETE'"
            style="background: var(--error); color: #fff"
          >
            delete forever
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Ref } from "vue";
import { usePreferences } from "~/composables/usePreferences";
import { useConnections } from "~/composables/useConnections";

definePageMeta({ layout: "app", middleware: "auth" });
useHead({ title: "Wanderist — Settings" });

const sections = [
  { id: "profile", label: "Profile" },
  { id: "account", label: "Email & password" },
  { id: "connections", label: "Connections" },
  { id: "prefs", label: "Units & map" },
  { id: "privacy", label: "Privacy" },
  { id: "danger", label: "Danger zone" },
];

const { user } = useClerkUser();
const { preferences, loadError, saveError, fetchPreferences, savePreferences } =
  usePreferences();

const {
  connections,
  isLoading: connectionsLoading,
  loadError: connectionsLoadError,
  actionError: connectionsActionError,
  importResult,
  fetchConnections,
  startInstagramConnect,
  disconnectInstagram,
  disconnectGoogle,
  importInstagramPhotos,
} = useConnections();

// Local editable copies — populated once preferences load.
const profile = reactive({
  name: "",
  handle: "",
  homeBase: "",
  bio: "",
  email: "",
});

const privacy = reactive({
  publicProfile: false,
  preciseLocation: false,
  showOnExplore: true,
});

const units = ref<"mi" | "km">("mi");
const mapStyle = ref("outdoors");

const mapStyles = [
  { value: "outdoors", label: "Outdoors" },
  { value: "streets", label: "Streets" },
  { value: "satellite", label: "Satellite" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "custom", label: "Wanderist violet" },
];

function populateFromPreferences(): void {
  profile.name = preferences.value.displayName ?? "";
  profile.handle = preferences.value.handle ?? "";
  profile.homeBase = preferences.value.homeBase ?? "";
  profile.bio = preferences.value.bio ?? "";
  privacy.publicProfile = preferences.value.publicProfile;
  privacy.preciseLocation = preferences.value.preciseLocation;
  privacy.showOnExplore = preferences.value.showOnExplore;
  units.value = preferences.value.distanceUnit as "mi" | "km";
  mapStyle.value = preferences.value.defaultMapStyle ?? "outdoors";
}

function populateEmailFromClerk(): void {
  if (!user.value) {
    return;
  }
  const primaryEmail = user.value.emailAddresses.find(
    (address) => address.id === user.value!.primaryEmailAddressId,
  );
  profile.email = primaryEmail?.emailAddress ?? "";
}

watch(
  user,
  () => {
    populateEmailFromClerk();
  },
  { immediate: true },
);

// Populate from defaults immediately (before the API call) so the form is not
// blank on first render. After fetch resolves, repopulate with server data.
// `hasPopulatedFromServer` then blocks the watch so user edits are not
// overwritten by incidental state updates after the initial load.
const hasPopulatedFromServer = ref(false);

watch(
  preferences,
  () => {
    if (hasPopulatedFromServer.value) {
      return;
    }
    populateFromPreferences();
  },
  { immediate: true },
);

const instagramConnectionSuccess = computed(
  () => useRoute().query.connection === "instagram_success",
);

const instagramConnectionError = computed(
  () => useRoute().query.connection_error === "instagram",
);

onMounted(async () => {
  await fetchPreferences();
  // `fetchPreferences` updates `preferences.value`; the watcher above fires
  // before this continuation resumes (Vue flushes on the next microtask).
  // Mark the flag here so the watcher stops overwriting user edits after load.
  hasPopulatedFromServer.value = true;

  await fetchConnections();
});

function handleConnectInstagram(): void {
  startInstagramConnect();
}

async function handleDisconnectInstagram(): Promise<void> {
  await disconnectInstagram();
}

async function handleDisconnectGoogle(): Promise<void> {
  await disconnectGoogle();
}

async function handleImportInstagram(): Promise<void> {
  await importInstagramPhotos();
}

const TOAST_DURATION_MS = 2200;

const showPasswordFields = ref(false);
const showSaved = ref(false);
const showErrorBar = ref(false);
const savedTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const errorTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const deleteModal = ref(false);
const deleteConfirm = ref("");
const activeSection = ref("profile");
const sectionsRef = ref<HTMLElement | null>(null);

onUnmounted(() => {
  if (savedTimer.value !== null) {
    clearTimeout(savedTimer.value);
  }
  if (errorTimer.value !== null) {
    clearTimeout(errorTimer.value);
  }
});

function showToast(
  visible: Ref<boolean>,
  timer: Ref<ReturnType<typeof setTimeout> | null>,
): void {
  if (timer.value !== null) {
    clearTimeout(timer.value);
  }
  visible.value = true;
  timer.value = setTimeout(() => {
    visible.value = false;
  }, TOAST_DURATION_MS);
}

function nullableString(value: string): string | null {
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

async function saveChanges(): Promise<void> {
  if (loadError.value) {
    return;
  }

  const succeeded = await savePreferences({
    displayName: nullableString(profile.name),
    handle: nullableString(profile.handle),
    homeBase: nullableString(profile.homeBase),
    bio: nullableString(profile.bio),
    publicProfile: privacy.publicProfile,
    preciseLocation: privacy.preciseLocation,
    showOnExplore: privacy.showOnExplore,
    distanceUnit: units.value,
    defaultMapStyle: mapStyle.value,
  });

  if (!succeeded) {
    showToast(showErrorBar, errorTimer);
    return;
  }

  showToast(showSaved, savedTimer);
}

function scrollTo(id: string) {
  document
    .getElementById(id)
    ?.scrollIntoView({ behavior: "smooth", block: "start" });
}

if (import.meta.client) {
  onMounted(() => {
    const navSections = sections.map((s) => document.getElementById(s.id));
    const onScroll = () => {
      const y = window.scrollY + 120;
      let idx = 0;
      navSections.forEach((section, i) => {
        if (section && section.offsetTop <= y) {
          idx = i;
        }
      });
      activeSection.value = sections[idx]?.id ?? "profile";
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onUnmounted(() => window.removeEventListener("scroll", onScroll));
  });
}
</script>

<style scoped>
.load-error {
  margin-bottom: 16px;
}
.set-layout {
  display: grid;
  grid-template-columns: 184px 1fr;
  gap: 34px;
  align-items: start;
}
.set-nav {
  position: sticky;
  top: 92px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.set-nav a {
  padding: 8px 11px;
  border-radius: var(--radius-sm);
  font-size: 12.5px;
  color: var(--ink-2);
  border-left: 2px solid transparent;
}
.set-nav a:hover {
  color: var(--accent-ink);
}
.set-nav a.is-active {
  color: var(--accent-ink);
  background: var(--accent-weak);
  border-left-color: var(--accent);
  font-weight: 500;
}
.set-sections {
  display: flex;
  flex-direction: column;
  gap: 22px;
  max-width: 720px;
}
.sect {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 24px;
  scroll-margin-top: 92px;
}
.sect__head {
  margin-bottom: 18px;
}
.sect__head h3 {
  font-size: 17px;
}
.sect__head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--muted);
}
.row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}
.avatar-row {
  display: flex;
  align-items: center;
  gap: 18px;
  margin-bottom: 20px;
}
.avatar {
  width: 72px;
  height: 72px;
  border-radius: 16px;
  flex: none;
  background: var(--accent-weak);
  display: grid;
  place-items: center;
  color: var(--accent-ink);
  position: relative;
  overflow: hidden;
  border: 1px solid var(--accent-line);
}
.avatar .topo {
  opacity: 0.5;
}

.switch {
  position: relative;
  width: 40px;
  height: 23px;
  flex: none;
}
.switch input {
  position: absolute;
  opacity: 0;
  width: 100%;
  height: 100%;
  margin: 0;
  cursor: pointer;
  z-index: 2;
}
.switch span {
  position: absolute;
  inset: 0;
  border-radius: 99px;
  background: var(--line-strong);
  transition: background 0.18s;
}
.switch span::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 19px;
  height: 19px;
  border-radius: 50%;
  background: #fff;
  transition: transform 0.18s;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}
.switch input:checked + span {
  background: var(--accent);
}
.switch input:checked + span::after {
  transform: translateX(17px);
}

.opt-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 14px 0;
  border-bottom: 1px dashed var(--line);
}
.opt-row:last-child {
  border-bottom: none;
}
.opt-row .lbl b {
  font-size: 13px;
  font-weight: 600;
}
.opt-row .lbl p {
  margin: 3px 0 0;
  font-size: 11.5px;
  color: var(--muted);
  max-width: 360px;
  line-height: 1.5;
}

.conn {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 14px 0;
  border-bottom: 1px dashed var(--line);
}
.conn:last-child {
  border-bottom: none;
}
.conn__logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: grid;
  place-items: center;
  border: 1px solid var(--line);
  background: var(--surface-2);
  flex: none;
}
.conn__meta b {
  font-size: 13px;
}
.conn__meta p {
  margin: 2px 0 0;
  font-size: 11.5px;
  color: var(--muted);
}
.conn .right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 10px;
}
.status-dot {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: var(--success-ink);
}
.status-dot::before {
  content: "";
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--success);
}

.map-style-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}
.map-style {
  cursor: pointer;
  border: 1px solid var(--line-strong);
  border-radius: 10px;
  overflow: hidden;
  background: var(--surface-2);
}
.map-style input {
  position: absolute;
  opacity: 0;
}
.map-style__pv {
  height: 54px;
  position: relative;
}
.pv-outdoors {
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0 7px,
      color-mix(in srgb, var(--accent) 28%, transparent) 7px 8px
    ),
    var(--bg-tint);
}
.pv-streets {
  background:
    repeating-linear-gradient(90deg, #f6f4ef 0 7px, var(--line-strong) 7px 8px),
    repeating-linear-gradient(
      0deg,
      transparent 0 7px,
      var(--line-strong) 7px 8px
    ),
    #f6f4ef;
}
.pv-satellite {
  background:
    radial-gradient(circle at 30% 35%, #324326, transparent 60%),
    linear-gradient(135deg, #283520, #18242f);
}
.pv-light {
  background:
    repeating-linear-gradient(90deg, #fbfaf7 0 9px, var(--line) 9px 10px),
    #fbfaf7;
}
.pv-dark {
  background:
    repeating-linear-gradient(90deg, #15140f 0 8px, #2c2a26 8px 9px), #15140f;
}
.pv-custom {
  background:
    repeating-linear-gradient(
      0deg,
      transparent 0 7px,
      color-mix(in srgb, var(--accent) 32%, transparent) 7px 8px
    ),
    var(--accent-weak);
}
.map-style__l {
  padding: 7px 9px;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.map-style.is-active {
  border-color: var(--accent);
  box-shadow: 0 0 0 2px var(--accent-weak);
}
.check {
  color: var(--accent);
}

.danger {
  border-color: color-mix(in srgb, var(--error) 35%, var(--line));
}
.danger .sect__head h3 {
  color: var(--error-ink);
}

.modal-scrim {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: none;
  place-items: center;
  z-index: 80;
  padding: 20px;
}
.modal-scrim.is-open {
  display: grid;
}
.modal {
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  padding: 26px;
  max-width: 420px;
  width: 100%;
  box-shadow: var(--shadow-lg);
}
.modal h3 {
  font-size: 18px;
  margin-bottom: 8px;
}
.modal p {
  font-size: 13px;
  color: var(--ink-2);
  line-height: 1.6;
  margin: 0 0 18px;
}

.saved-bar {
  position: fixed;
  left: 50%;
  bottom: 24px;
  transform: translate(-50%, 30px);
  opacity: 0;
  transition: all 0.25s;
  z-index: 70;
}
.saved-bar.show {
  transform: translateX(-50%);
  opacity: 1;
}

@media (max-width: 820px) {
  .set-layout {
    grid-template-columns: 1fr;
    gap: 18px;
  }
  .set-nav {
    position: static;
    flex-direction: row;
    flex-wrap: wrap;
    gap: 6px;
  }
  .row {
    grid-template-columns: 1fr;
  }
  .map-style-grid {
    grid-template-columns: 1fr;
  }
}
</style>

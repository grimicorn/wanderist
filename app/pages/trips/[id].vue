<template>
  <div class="content content--wide" style="padding-top:0">
    <!-- Hero -->
    <div class="thero ph">
      <div class="topo" />
      <div class="thero__veil" />
      <div class="thero__acts">
        <button class="btn btn--outline btn--sm" style="background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.4);color:#fff">
          <AppIcon name="image" :size="14" />
          edit cover
        </button>
        <button class="btn btn--outline btn--sm" style="background:rgba(255,255,255,.12);border-color:rgba(255,255,255,.4);color:#fff">
          <AppIcon name="globe" :size="14" />
          share
        </button>
      </div>
      <div class="thero__in">
        <div class="label">// ongoing · day 6 of 9</div>
        <h1>Iceland, the ring road</h1>
        <div class="thero__meta">
          <span><AppIcon name="calendar" :size="14" /> Jun 9 – Jun 17, 2026</span>
          <span><AppIcon name="pin" :size="14" /> 7 stops · 1,332 km loop</span>
          <span><AppIcon name="journal" :size="14" /> 4 entries</span>
          <span><AppIcon name="users" :size="14" /> with Maya</span>
        </div>
      </div>
    </div>

    <div class="tdcols">
      <!-- Itinerary -->
      <div>
        <div class="iti-head">
          <div>
            <div class="label">// itinerary</div>
            <h2 class="display" style="font-size:20px;margin-top:8px">Route &amp; stops</h2>
          </div>
          <button class="btn btn--ghost btn--sm">
            <AppIcon name="sliders" :size="14" />
            reorder
          </button>
        </div>

        <div class="iti">
          <div class="stop is-done">
            <div class="stop__node"><div class="stop__pin"><AppIcon name="check" :size="18" /></div></div>
            <div class="stop__card">
              <div class="stop__top">
                <div>
                  <div class="stop__name">Reykjavík</div>
                  <div class="stop__sub"><AppIcon name="calendar" :size="12" /> Jun 9–11 · 2 nights <span class="tag tag--accent">base</span></div>
                </div>
                <span class="stop__grip"><AppIcon name="grip" :size="16" /></span>
              </div>
              <p class="stop__note">Landed, picked up the camper. Old harbour at 4am, Hallgrímskirkja, then stocked up before heading east.</p>
              <div class="stop__foot">
                <span class="m"><AppIcon name="journal" :size="12" /> 2 entries</span>
                <span class="m"><AppIcon name="image" :size="12" /> 28 photos</span>
                <span class="m"><AppIcon name="plane" :size="12" /> arrival</span>
              </div>
            </div>
          </div>

          <div class="stop is-done">
            <div class="stop__node"><div class="stop__pin">2</div></div>
            <div class="stop__card">
              <div class="stop__top">
                <div>
                  <div class="stop__name">Þingvellir &amp; the Golden Circle</div>
                  <div class="stop__sub"><AppIcon name="calendar" :size="12" /> Jun 11 · day trip</div>
                </div>
                <span class="stop__grip"><AppIcon name="grip" :size="16" /></span>
              </div>
              <p class="stop__note">Continental rift, Geysir, Gullfoss. Rained sideways the whole afternoon and it was still worth it.</p>
              <div class="stop__foot">
                <span class="m"><AppIcon name="journal" :size="12" /> 1 entry</span>
                <span class="m"><AppIcon name="image" :size="12" /> 19 photos</span>
                <span class="m"><AppIcon name="ruler" :size="12" /> 250 km</span>
              </div>
            </div>
          </div>

          <div class="stop is-done">
            <div class="stop__node"><div class="stop__pin">3</div></div>
            <div class="stop__card">
              <div class="stop__top">
                <div>
                  <div class="stop__name">Vík í Mýrdal</div>
                  <div class="stop__sub"><AppIcon name="calendar" :size="12" /> Jun 12–13 · 1 night</div>
                </div>
                <span class="stop__grip"><AppIcon name="grip" :size="16" /></span>
              </div>
              <p class="stop__note">Black sand at Reynisfjara, the church on the hill. Puffins finally showed up near the cliffs.</p>
              <div class="stop__foot">
                <span class="m"><AppIcon name="journal" :size="12" /> 1 entry</span>
                <span class="m"><AppIcon name="image" :size="12" /> 14 photos</span>
                <span class="m"><AppIcon name="ruler" :size="12" /> 187 km</span>
              </div>
            </div>
          </div>

          <div class="stop is-next">
            <div class="stop__node"><div class="stop__pin"><AppIcon name="pin" :size="18" /></div></div>
            <div class="stop__card">
              <div class="stop__top">
                <div>
                  <div class="stop__name">Jökulsárlón glacier lagoon</div>
                  <div class="stop__sub"><span class="tag tag--accent">next · today</span> 1h 40m drive ahead</div>
                </div>
                <span class="stop__grip"><AppIcon name="grip" :size="16" /></span>
              </div>
              <p class="stop__note">Icebergs calving into the lagoon, then Diamond Beach at golden hour. Camp at Höfn after.</p>
              <div class="stop__foot">
                <span class="m"><AppIcon name="clock" :size="12" /> arrive ~2:30pm</span>
                <span class="m"><AppIcon name="ruler" :size="12" /> 270 km</span>
                <span class="m"><AppIcon name="bookmark" :size="12" /> 3 saved spots</span>
              </div>
            </div>
          </div>

          <div class="stop">
            <div class="stop__node"><div class="stop__pin">5</div></div>
            <div class="stop__card">
              <div class="stop__top">
                <div>
                  <div class="stop__name">Höfn &amp; the eastfjords</div>
                  <div class="stop__sub"><AppIcon name="calendar" :size="12" /> Jun 14–15 · 1 night</div>
                </div>
                <span class="stop__grip"><AppIcon name="grip" :size="16" /></span>
              </div>
              <div class="stop__foot">
                <span class="m"><AppIcon name="ruler" :size="12" /> 180 km</span>
                <span class="m"><AppIcon name="bookmark" :size="12" /> langoustine, harbour</span>
              </div>
            </div>
          </div>

          <div class="stop">
            <div class="stop__node"><div class="stop__pin">6</div></div>
            <div class="stop__card">
              <div class="stop__top">
                <div>
                  <div class="stop__name">Mývatn &amp; the north</div>
                  <div class="stop__sub"><AppIcon name="calendar" :size="12" /> Jun 16 · geothermal</div>
                </div>
                <span class="stop__grip"><AppIcon name="grip" :size="16" /></span>
              </div>
              <div class="stop__foot">
                <span class="m"><AppIcon name="ruler" :size="12" /> 360 km</span>
                <span class="m"><AppIcon name="bookmark" :size="12" /> nature baths</span>
              </div>
            </div>
          </div>

          <div class="stop__add">
            <div />
            <button class="add-btn">
              <AppIcon name="plus" :size="15" />
              add a stop
            </button>
          </div>
        </div>
      </div>

      <!-- Rail -->
      <aside class="trail">
        <div class="rail-card" style="padding:0;overflow:hidden">
          <div class="mini-map">
            <div class="topo" />
            <span class="pin-abs" style="left:30%;top:42%"><AppIcon name="pin" :size="18" class="pin" /></span>
            <span class="pin-abs" style="left:48%;top:58%"><AppIcon name="pin" :size="18" class="pin" /></span>
            <span class="pin-abs" style="left:60%;top:70%"><AppIcon name="pin" :size="18" class="pin" /></span>
            <span class="pin-abs" style="left:74%;top:54%"><AppIcon name="pin" :size="18" class="pin" /></span>
          </div>
          <div style="padding:13px 16px">
            <NuxtLink class="btn btn--outline btn--sm btn--block" to="/map">
              <AppIcon name="map" :size="14" />
              open in full map
            </NuxtLink>
          </div>
        </div>

        <div class="rail-card">
          <h4 class="display">Trip facts</h4>
          <div class="fact"><span class="k">Status</span><span class="v" style="color:var(--success-ink)">Ongoing</span></div>
          <div class="fact"><span class="k">Distance</span><span class="v">1,332 km</span></div>
          <div class="fact"><span class="k">Logged</span><span class="v">892 / 1,332 km</span></div>
          <div class="fact"><span class="k">Nights</span><span class="v">8</span></div>
          <div class="fact"><span class="k">Photos</span><span class="v">61</span></div>
          <div class="fact"><span class="k">Visibility</span><span class="v">Private</span></div>
        </div>

        <div class="rail-card">
          <h4 class="display" style="display:flex;align-items:center;justify-content:space-between">
            Travelling with
            <button class="label label--plain" style="font-size:10px;border:none;background:none;color:var(--accent-ink)">invite</button>
          </h4>
          <div class="companions">
            <div class="companion">
              <span class="companion__av"><AppIcon name="user" :size="16" /></span>
              <div><b>Maya R.</b><br><span>@mayarambles · editor</span></div>
            </div>
            <div class="companion">
              <span class="companion__av" style="background:var(--bg-tint);color:var(--muted)"><AppIcon name="plus" :size="16" /></span>
              <div><b>Invite someone</b><br><span>add a co-traveller</span></div>
            </div>
          </div>
        </div>
      </aside>
    </div>
  </div>
</template>

<script setup lang="ts">
definePageMeta({ layout: 'app', middleware: 'auth' })
useHead({ title: 'Wanderist — Iceland, the ring road' })
</script>

<style scoped>
.thero { position: relative; height: 280px; border-radius: var(--radius-lg); overflow: hidden; border: 1px solid var(--line); margin: 22px 0 24px; display: flex; align-items: flex-end; }
.thero .topo { opacity: .5; }
.thero__veil { position: absolute; inset: 0; background: linear-gradient(to top, rgba(20,17,14,.78), rgba(20,17,14,.1) 60%, transparent); z-index: 1; }
.thero__in { position: relative; z-index: 2; padding: 26px 28px; color: #fff; width: 100%; }
.thero__in .label { color: #fff; }
.thero__in :deep(.label::before) { background: #fff; }
.thero h1 { color: #fff; font-size: 30px; font-weight: 700; letter-spacing: -.02em; margin: 8px 0 10px; }
.thero__meta { display: flex; gap: 18px; flex-wrap: wrap; font-size: 12.5px; color: rgba(255,255,255,.85); }
.thero__meta span { display: inline-flex; align-items: center; gap: 6px; }
.thero__acts { position: absolute; top: 18px; right: 20px; z-index: 2; display: flex; gap: 8px; }

.tdcols { display: grid; grid-template-columns: minmax(0,1fr) 320px; gap: 28px; align-items: start; }

.iti-head { display: flex; align-items: center; justify-content: space-between; margin-bottom: 18px; }
.iti { position: relative; }
.iti::before { content: ''; position: absolute; left: 19px; top: 8px; bottom: 40px; width: 2px; background: var(--line); }
.stop { position: relative; display: grid; grid-template-columns: 40px 1fr; gap: 14px; margin-bottom: 16px; }
.stop__node { width: 40px; display: flex; flex-direction: column; align-items: center; }
.stop__pin { width: 40px; height: 40px; border-radius: 50%; background: var(--surface); border: 2px solid var(--line-strong); display: grid; place-items: center; color: var(--muted); font-family: var(--font-display); font-weight: 700; font-size: 14px; z-index: 1; }
.stop.is-done .stop__pin { background: var(--accent); border-color: var(--accent); color: #fff; }
.stop.is-next .stop__pin { border-color: var(--accent); color: var(--accent-ink); box-shadow: 0 0 0 4px var(--accent-weak); }
.stop__card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 15px 17px; }
.stop.is-next .stop__card { border-color: var(--accent-line); }
.stop__top { display: flex; align-items: flex-start; gap: 12px; }
.stop__name { font-family: var(--font-display); font-size: 16px; font-weight: 600; }
.stop__sub { font-size: 11.5px; color: var(--muted); margin-top: 2px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.stop__grip { margin-left: auto; color: var(--faint); cursor: grab; }
.stop__note { font-size: 12.5px; color: var(--ink-2); line-height: 1.55; margin: 10px 0 0; }
.stop__foot { display: flex; gap: 14px; margin-top: 11px; padding-top: 11px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); }
.stop__foot .m { display: inline-flex; align-items: center; gap: 5px; }
.stop__add { display: grid; grid-template-columns: 40px 1fr; gap: 14px; }
.stop__add .add-btn { border: 1px dashed var(--line-strong); border-radius: var(--radius); padding: 13px; background: none; color: var(--muted); font-family: var(--font-mono); font-size: 12.5px; display: flex; align-items: center; gap: 8px; justify-content: center; }
.stop__add .add-btn:hover { border-color: var(--accent); color: var(--accent-ink); }

.trail { position: sticky; top: 92px; display: flex; flex-direction: column; gap: 16px; }
.rail-card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
.rail-card h4 { font-size: 13px; margin-bottom: 12px; }
.mini-map { height: 180px; border-radius: var(--radius-sm); position: relative; overflow: hidden; margin: -2px 0 0; border: 1px solid var(--line); background:
  repeating-linear-gradient(0deg, transparent 0 23px, color-mix(in srgb,var(--line) 60%, transparent) 23px 24px),
  repeating-linear-gradient(90deg, transparent 0 23px, color-mix(in srgb,var(--line) 60%, transparent) 23px 24px), var(--bg-tint); }
.mini-map .topo { opacity: .4; }
.mini-map .pin-abs { position: absolute; transform: translate(-50%,-100%); }
.fact { display: flex; align-items: center; justify-content: space-between; padding: 9px 0; border-bottom: 1px dashed var(--line); font-size: 12.5px; }
.fact:last-child { border-bottom: none; }
.fact .k { color: var(--muted); }
.fact .v { font-weight: 600; }
.companions { display: flex; flex-direction: column; gap: 10px; }
.companion { display: flex; align-items: center; gap: 11px; }
.companion__av { width: 32px; height: 32px; border-radius: 8px; background: var(--accent-weak); color: var(--accent-ink); display: grid; place-items: center; flex: none; }
.companion b { font-size: 12.5px; }
.companion span { font-size: 11px; color: var(--muted); }

@media (max-width: 920px) { .tdcols { grid-template-columns: 1fr; } .trail { position: static; } }
</style>

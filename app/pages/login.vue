<template>
  <div class="auth">
    <!-- LEFT: brand panel -->
    <div class="auth__brand">
      <div class="topo" />
      <span class="pin-float" style="left: 64%; top: 30%">
        <AppIcon name="pin" :size="26" class="pin" />
        <small>tokyo</small>
      </span>
      <span class="pin-float" style="left: 42%; top: 46%">
        <AppIcon name="pin" :size="20" class="pin" />
        <small>lisbon</small>
      </span>

      <div class="brand-top">
        <NuxtLink class="brand" to="/">
          <AppIcon name="compass" :size="26" class="brand__mark" />
          <span class="brand__name">wander<b>ist</b></span>
        </NuxtLink>
        <AppThemeToggle />
      </div>

      <div class="brand-mid">
        <div class="label">// 117 places · 9 countries</div>
        <h1 style="margin-top: 14px">Your map is<br /><b>waiting.</b></h1>
        <p>
          Pick up where you left off — every pin, journal entry and photo,
          exactly where you dropped it.
        </p>
        <div class="stamp">
          <div>
            <div class="k">Last entry</div>
            <div class="v">Reykjavík</div>
          </div>
          <div>
            <div class="k">Streak</div>
            <div class="v">14 days</div>
          </div>
          <div>
            <div class="k">Miles logged</div>
            <div class="v">48,210</div>
          </div>
        </div>
      </div>
    </div>

    <!-- RIGHT: Clerk sign-in form -->
    <div class="auth__form">
      <div class="auth__form-inner">
        <div class="auth-corner">
          <AppThemeToggle />
        </div>
        <SignIn
          :appearance="{
            variables: {
              colorPrimary: '#a855f7',
              colorBackground: 'var(--surface)',
              colorInputBackground: 'var(--surface-2)',
              colorInputText: 'var(--ink)',
              colorText: 'var(--ink)',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              borderRadius: '7px',
            },
          }"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
useHead({ title: "Wanderist — Sign in" });

definePageMeta({ layout: false });
</script>

<style scoped>
.auth {
  display: grid;
  grid-template-columns: 1.05fr 0.95fr;
  min-height: 100vh;
}

.auth__brand {
  position: relative;
  overflow: hidden;
  background: var(--bg-tint);
  border-right: 1px solid var(--line);
  display: flex;
  flex-direction: column;
  padding: 40px 48px;
}
.auth__brand .topo {
  opacity: calc(var(--topo-opacity) * 1.8);
}

.brand-top {
  position: relative;
  z-index: 2;
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.brand-mid {
  position: relative;
  z-index: 2;
  margin-top: auto;
}
.brand-mid h1 {
  font-size: clamp(32px, 4vw, 50px);
  line-height: 0.98;
  font-weight: 700;
  letter-spacing: -0.025em;
}
.brand-mid h1 b {
  color: var(--accent-ink);
}
.brand-mid p {
  max-width: 380px;
  margin: 18px 0 0;
  color: var(--ink-2);
  font-size: 14px;
  line-height: 1.65;
}

.stamp {
  position: relative;
  z-index: 2;
  margin-top: 34px;
  display: flex;
  gap: 26px;
  flex-wrap: wrap;
}
.stamp div .k {
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--muted);
}
.stamp div .v {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  margin-top: 3px;
}

.pin-float {
  position: absolute;
  z-index: 2;
}
.pin-float small {
  display: block;
  font-size: 9.5px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--muted);
  margin-top: 2px;
  padding-left: 2px;
}

.auth__form {
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 40px clamp(28px, 7vw, 96px);
  position: relative;
}
.auth__form-inner {
  width: 100%;
  max-width: 420px;
  margin: 0 auto;
}
.auth-corner {
  position: absolute;
  top: 28px;
  right: 32px;
}

@media (max-width: 860px) {
  .auth {
    grid-template-columns: 1fr;
  }
  .auth__brand {
    min-height: 240px;
    padding: 26px;
  }
  .brand-mid h1 {
    font-size: 34px;
  }
  .stamp {
    display: none;
  }
  .auth__form {
    padding: 36px 22px;
  }
  .auth-corner {
    top: 22px;
    right: 22px;
  }
}
</style>

import { useApiClient } from "~/composables/useApiClient";

export interface BillingConfigDto {
  wandererMonthlyConfigured: boolean;
  wandererYearlyConfigured: boolean;
  nomadMonthlyConfigured: boolean;
  nomadYearlyConfigured: boolean;
}

const BILLING_CONFIG_STATE_KEY = "billing-config";
const BILLING_CONFIG_LOADED_KEY = "billing-config-loaded";

const UNCONFIGURED_DEFAULT: BillingConfigDto = {
  wandererMonthlyConfigured: false,
  wandererYearlyConfigured: false,
  nomadMonthlyConfigured: false,
  nomadYearlyConfigured: false,
};

// Module-scoped (not per-call-site) so every <PlanCheckoutButton> that mounts
// around the same time awaits the same in-flight request instead of each
// firing its own — /pricing alone renders four of them.
let inFlightFetch: Promise<void> | null = null;

/**
 * Fetches which tier/cycle combinations have a Stripe Price ID configured,
 * from GET /api/billing/config. Used by <PlanCheckoutButton> to render
 * disabled instead of opening a checkout that would fail at runtime.
 *
 * Shared across every mounted <PlanCheckoutButton> via useState so the
 * multiple buttons on /pricing and / only trigger one fetch, not one per
 * button. Defaults to "nothing configured" (every button disabled) until the
 * fetch resolves or if it fails — the same safe fallback as an explicitly
 * unconfigured Price ID.
 */
export function useBillingConfig() {
  const { apiFetch } = useApiClient();

  const config = useState<BillingConfigDto>(BILLING_CONFIG_STATE_KEY, () => ({
    ...UNCONFIGURED_DEFAULT,
  }));
  const isLoaded = useState<boolean>(BILLING_CONFIG_LOADED_KEY, () => false);

  function fetchBillingConfig(): Promise<void> {
    if (isLoaded.value) {
      return Promise.resolve();
    }
    if (inFlightFetch) {
      return inFlightFetch;
    }
    inFlightFetch = (async () => {
      try {
        config.value = await apiFetch<BillingConfigDto>("/api/billing/config");
        isLoaded.value = true;
      } catch {
        // Leave the "nothing configured" default in place — every checkout
        // button just stays disabled rather than risking a broken checkout.
      } finally {
        inFlightFetch = null;
      }
    })();
    return inFlightFetch;
  }

  return { config: readonly(config), fetchBillingConfig };
}

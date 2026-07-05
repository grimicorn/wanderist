import { useApiClient } from "~/composables/useApiClient";
import { extractErrorMessage } from "~/utils/extractErrorMessage";

export type Plan = "drifter" | "wanderer" | "nomad";
export type SubscriptionStatus = "active" | "past_due" | "canceled";
export type BillingCycle = "monthly" | "yearly";

// Dates arrive as JSON-serialized ISO strings, not Date objects, at runtime —
// same convention as Trip/Place in the Pinia stores.
export interface UserSubscriptionDto {
  plan: Plan;
  status: SubscriptionStatus;
  billingCycle: BillingCycle | null;
  trialEndsAt: string | null;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

const BILLING_STATE_KEY = "user-subscription";

const FREE_SUBSCRIPTION_DEFAULT: UserSubscriptionDto = {
  plan: "drifter",
  status: "active",
  billingCycle: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
};

/**
 * Fetches and exposes the authenticated user's current plan/subscription
 * state from GET /api/billing/subscription. Used by the Settings "Plan &
 * Billing" section and anywhere else that needs to know the current tier.
 */
export function useBilling() {
  const { apiFetch } = useApiClient();

  const subscription = useState<UserSubscriptionDto>(BILLING_STATE_KEY, () => ({
    ...FREE_SUBSCRIPTION_DEFAULT,
  }));

  const isLoading = ref(false);
  const loadError = ref<string | null>(null);

  async function fetchSubscription(): Promise<void> {
    isLoading.value = true;
    loadError.value = null;

    try {
      subscription.value = await apiFetch<UserSubscriptionDto>(
        "/api/billing/subscription",
      );
    } catch (error: unknown) {
      subscription.value = { ...FREE_SUBSCRIPTION_DEFAULT };
      loadError.value = extractErrorMessage(error);
    } finally {
      isLoading.value = false;
    }
  }

  return {
    subscription,
    isLoading: readonly(isLoading),
    loadError: readonly(loadError),
    fetchSubscription,
  };
}

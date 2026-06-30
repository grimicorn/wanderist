export default defineNuxtRouteMiddleware(() => {
  const { isSignedIn, isLoaded } = useAuth();

  if (!isLoaded.value) {
    return;
  }

  if (!isSignedIn.value) {
    return navigateTo("/login");
  }
});

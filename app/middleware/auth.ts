export default defineNuxtRouteMiddleware(() => {
  const { isSignedIn, isLoaded } = useClerkAuth()

  if (!isLoaded.value) {
    return
  }

  if (!isSignedIn.value) {
    return navigateTo('/login')
  }
})

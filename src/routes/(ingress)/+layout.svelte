<script lang="ts">
  let { children } = $props();
  import HeroLayout from "$components/branding/HeroLayout.svelte";
  import { page } from "$app/state";

  const isOnboarding = $derived(page.url.pathname === "/onboarding");
  // Full-screen photo backdrop (mobile only) behind the landing and
  // sign-in content. Desktop rendering is untouched.
  const mobilePhotoBackground = $derived(
    page.url.pathname === "/" ||
      page.url.pathname === "/sign-in" ||
      page.url.pathname === "/sign-in/workspace"
  );
</script>

<HeroLayout contentClass={isOnboarding ? "max-w-xl" : "max-w-100"} {mobilePhotoBackground}>
  {@render children()}
</HeroLayout>

<script lang="ts">
  import { brandingState } from "$state/branding.svelte";
  import { cn } from "$utils";

  interface Props {
    class?: string;
    mode?: "light" | "dark" | "auto";
  }
  const { class: className = "h-8 w-auto mx-auto object-contain", mode = "auto" }: Props = $props();
  const baseImgClass = "h-full w-auto object-contain";
  const normalizeSrc = (src: string) =>
    src.startsWith("./") ? src.slice(1) : src;
  const lightSrc = $derived(normalizeSrc(brandingState.profile.logoUrl));
  const darkSrc = $derived(
    normalizeSrc(brandingState.profile.logoUrlDark || brandingState.profile.logoUrl)
  );
  const lightImgClass = $derived(
    cn(baseImgClass, {
      hidden: mode === "dark",
      "dark:hidden": mode === "auto"
    })
  );
  const darkImgClass = $derived(
    cn(baseImgClass, {
      hidden: mode === "light",
      "hidden dark:block": mode === "auto"
    })
  );
</script>

<div class={className}>
  <img
    src={lightSrc}
    alt={brandingState.profile.logoAlt}
    class={lightImgClass}
  />
  <img
    src={darkSrc}
    alt={brandingState.profile.logoAlt}
    class={darkImgClass}
  />
</div>

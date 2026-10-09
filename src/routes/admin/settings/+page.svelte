<script lang="ts">
  import { onMount } from "svelte";
  import { pageState } from "$state/page-info.svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import AppearanceCard from "$components/settings/AppearanceCard.svelte";
import NavSettingsCard from "$components/settings/NavSettingsCard.svelte";
import NotificationSettingsCard from "$components/settings/NotificationSettingsCard.svelte";
  import DevConfigCard from "$components/settings/DevConfigCard.svelte";
  import VersionCard from "$components/settings/VersionCard.svelte";

  onMount(() => {
    pageState.title = "Settings";
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader title="Settings" />

  <div class="flex flex-col gap-8 lg:flex-row">
    <!-- Left Column: Settings -->
    <div class="flex-1 space-y-8">
      <!-- Appearance Section -->
      <AppearanceCard />
      <NavSettingsCard />
      <NotificationSettingsCard />
      <DevConfigCard />
    </div>
    <VersionCard />
  </div>
</div>

<script lang="ts">
  import { auth } from "$state/auth.svelte";
  import { onMount } from "svelte";
  import { Button } from "$ui/button";
  import { RefreshCcw } from "@lucide/svelte";
  import LoadingView from "$components/content/LoadingView.svelte";
  import ErrorView from "$components/content/ErrorView.svelte";
  import { goto } from "$app/navigation";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import OccupancyHistoryCard from "$components/residents/OccupancyHistoryCard.svelte";
  import StudentProfileCard from "$components/residents/StudentProfileCard.svelte";
  import { pageState } from "$state/page-info.svelte";

  let status = $state<any>(null);
  let occupancyData = $state<any[]>([]);
  let isLoading = $state(true);
  let error = $state<string | null>(null);

  import { fetchResidentStatus, fetchResidents } from "$api/controllers/resident-controller";
  import { settings } from "$state/settings.svelte";

  async function loadData(bypassCache = false) {
    if (!auth.accessToken) return;
    isLoading = true;
    error = null;
    try {
      const [statusJson, occJson] = await Promise.all([
        fetchResidentStatus(undefined, bypassCache),
        fetchResidents(bypassCache)
      ]);

      status = statusJson;
      occupancyData = Array.isArray(occJson) ? occJson : (occJson as any).accounts || [];
    } catch (e: any) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  onMount(() => {
    pageState.title = "Occupancy";
    if (auth.accessToken) {
      loadData();
    } else {
      const interval = setInterval(() => {
        if (auth.accessToken) {
          clearInterval(interval);
          loadData();
        }
      }, 100);
      setTimeout(() => clearInterval(interval), 2000);
    }
  });
</script>

<div class="mx-auto max-w-7xl space-y-3">
  <ContentHeader
    title="Occupancy"
    isTopLevel={true}
    onRefresh={() => loadData(true)}
    isRefreshing={isLoading}
  />

  {#if isLoading && occupancyData.length === 0}
    <LoadingView />
  {:else if error}
    <ErrorView {error}>
      <Button onclick={() => loadData()} class="mt-4" {isLoading} icon={RefreshCcw}>Retry</Button>
    </ErrorView>
  {:else}
    <div class="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div class="lg:col-span-4">
        {#if status?.account || occupancyData.length > 0}
          <StudentProfileCard
            account={status?.account || occupancyData[0]}
            semesterCount={occupancyData.length}
            avatarUrl={status?.profile?.avatarUrl ||
              auth.user?.avatarUrl ||
              auth.avatarUrl ||
              ""}
          />
        {/if}
      </div>

      <div class="lg:col-span-8">
        <OccupancyHistoryCard
          accounts={occupancyData}
          onRowClick={(r) => {
            settings.currentTerm = r.period;
            goto(`/resident/finance`);
          }}
        />
      </div>
    </div>
  {/if}
</div>

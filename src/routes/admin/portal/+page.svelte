<script lang="ts">
  import { onMount } from "svelte";
  import ContentHeader from "$components/content/ContentHeader.svelte";
  import PublicSnapshotSyncCard from "$components/portal/PublicSnapshotSyncCard.svelte";
  import { pageState } from "$state/page-info.svelte";
  import { Button } from "$ui/button";
  import * as Card from "$ui/card";
  import { FileText, Image } from "@lucide/svelte";

  onMount(() => {
    pageState.title = "Portal";
  });
</script>

<div class="mx-auto max-w-7xl space-y-6">
  <ContentHeader
    title="Portal"
    subtitle="Manage publications and publish redacted data to the NFRH public portal."
    isTopLevel={true}
  />

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <FileText class="size-4 text-brand" />
        Publications
      </Card.Title>
      <Card.Description>
        Create and manage the publications shown on the public portal.
      </Card.Description>
    </Card.Header>
    <Card.Content>
      <Button href="/admin/portal/publications" size="sm" icon={FileText}>
        Manage Publications
      </Button>
    </Card.Content>
  </Card.Root>

  <Card.Root>
    <Card.Header>
      <Card.Title class="flex items-center gap-2">
        <Image class="size-4 text-brand" />
        Homepage
      </Card.Title>
      <Card.Description
        >Manage the public portal hero heading, subheading, and image.</Card.Description
      >
    </Card.Header>
    <Card.Content>
      <Button href="/admin/portal/homepage" size="sm" icon={Image}>Manage Homepage</Button>
    </Card.Content>
  </Card.Root>

  <PublicSnapshotSyncCard />
</div>

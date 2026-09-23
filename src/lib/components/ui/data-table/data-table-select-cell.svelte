<script lang="ts">
  import { Checkbox } from "$ui/checkbox/index.js";

  let {
    row,
    disabled = false
  }: {
    row: {
      getIsSelected: () => boolean;
      toggleSelected: (value: boolean) => void;
      [key: string]: any;
    };
    disabled?: boolean;
  } = $props();
</script>

<div onclick={(e) => e.stopPropagation()} role="presentation">
  <Checkbox
    checked={row.getIsSelected()}
    onCheckedChange={(value) => row.toggleSelected(!!value)}
    {disabled}
    aria-label="Select row"
  />
</div>

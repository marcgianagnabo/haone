<script lang="ts">
  import * as Card from "$ui/card";
  import { Button } from "$ui/button";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { Checkbox } from "$ui/checkbox";
  import { Lock, LockOpen } from "@lucide/svelte";
  import { Spinner } from "../ui/spinner";
  import BrandingLogo from "../branding/BrandingLogo.svelte";
  import { maskStudentNoInput } from "$utils/student-no";

  let {
    studentNo = $bindable(),
    rememberMe = $bindable(),
    isDecrypting,
    onAuthenticate,
    title = "Authentication Required",
    description = "Please enter your student number (temporary or permanent) to access this document."
  } = $props<{
    studentNo: string;
    rememberMe: boolean;
    isDecrypting: boolean;
    onAuthenticate: () => void;
    title?: string;
    description?: string;
  }>();
</script>

<div class="mb-5 flex justify-center">
  <BrandingLogo class="h-16 w-auto object-contain" />
</div>

<Card.Root class="w-full max-w-sm shadow-sm ring-0">
  <Card.Header class="text-center">
    <div class="relative mb-4 flex items-center justify-center">
      <div
        class="flex h-16 w-16 items-center justify-center rounded-full bg-brand text-brand-foreground"
      >
        <Lock class="h-8 w-8 stroke-3" />
      </div>
    </div>
    <Card.Title class="text-2xl font-bold tracking-tight">{title}</Card.Title>
    <Card.Description>{description}</Card.Description>
  </Card.Header>
  <Card.Content class="space-y-4">
    <div class="space-y-2">
      <Label for="stno">Student Number</Label>
      <Input
        id="stno"
        name="stno"
        type="text"
        bind:value={studentNo}
        oninput={(e) => (studentNo = maskStudentNoInput(e.currentTarget.value))}
        placeholder="e.g., 2021-00001"
        autocomplete="off"
        inputmode="numeric"
        onkeydown={(e) => e.key === "Enter" && onAuthenticate()}
      />
    </div>
    <div class="flex items-center space-x-2">
      <Checkbox id="remember" name="remember" bind:checked={rememberMe} />
      <Label for="remember" class="peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
        Remember student ID
      </Label>
    </div>
    <Button
      type="submit"
      onclick={onAuthenticate}
      class="w-full"
      disabled={isDecrypting || !studentNo}
      icon={isDecrypting ? Spinner : LockOpen}
    >
      {isDecrypting ? "Verifying…" : "Unlock"}
    </Button>
  </Card.Content>
</Card.Root>

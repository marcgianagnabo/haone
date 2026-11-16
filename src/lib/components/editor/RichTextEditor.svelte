<script lang="ts">
  import { onMount } from "svelte";
  import { Editor, Extension } from "@tiptap/core";
  import StarterKit from "@tiptap/starter-kit";
  import Link from "@tiptap/extension-link";
  import BulletList from "@tiptap/extension-bullet-list";
  import OrderedList from "@tiptap/extension-ordered-list";
  import ListItem from "@tiptap/extension-list-item";
  import Underline from "@tiptap/extension-underline";
  import Placeholder from "@tiptap/extension-placeholder";
  import Image from "@tiptap/extension-image";
  import { Table } from "@tiptap/extension-table";
  import { TableRow } from "@tiptap/extension-table-row";
  import { TableHeader } from "@tiptap/extension-table-header";
  import { TableCell } from "@tiptap/extension-table-cell";
  import { TextAlign } from "@tiptap/extension-text-align";
  import { Highlight } from "@tiptap/extension-highlight";
  import { TextStyle } from "@tiptap/extension-text-style";
  import { Color } from "@tiptap/extension-color";
  import { Subscript } from "@tiptap/extension-subscript";
  import { Superscript } from "@tiptap/extension-superscript";
  import { TaskList } from "@tiptap/extension-task-list";
  import { TaskItem } from "@tiptap/extension-task-item";
  import { Button } from "$ui/button";
  import * as Dialog from "$ui/dialog";
  import * as Popover from "$ui/popover";
  import { Input } from "$ui/input";
  import { Label } from "$ui/label";
  import { ImageUpload } from "$components/ui/haone";
  import { transformGoogleDriveLink } from "$utils/image-utils";
  import { fetchServer } from "$utils/api-client";
  import { toast } from "svelte-sonner";
  import {
    Bold,
    Italic,
    Underline as UnderlineIcon,
    List,
    ListOrdered,
    Link as LinkIcon,
    Unlink,
    RotateCcw,
    Image as ImageIcon,
    Highlighter,
    Subscript as SubscriptIcon,
    Superscript as SuperscriptIcon,
    Table as TableIcon,
    Palette,
    Trash2,
    TextAlignStart,
    TextAlignCenter,
    TextAlignEnd,
    TextAlignJustify,
    SquareCheckBig,
    Rows2,
    Columns2
  } from "@lucide/svelte";
  import { cn } from "$lib/utils";
  import RichTextWrapper from "./RichTextWrapper.svelte";

  const FontSizeExtension = Extension.create({
    name: "emailFontSize",
    addGlobalAttributes() {
      return [
        {
          types: ["textStyle"],
          attributes: {
            fontSize: {
              default: null,
              parseHTML: (element) => element.style.fontSize || null,
              renderHTML: (attributes) =>
                attributes.fontSize ? { style: `font-size: ${attributes.fontSize}` } : {}
            }
          }
        }
      ];
    }
  });

  let {
    content = $bindable(),
    placeholder = "Start typing reminders…",
    editable = true,
    enableFontSize = false,
    actions = $bindable()
  } = $props<{
    content: string;
    placeholder?: string;
    editable?: boolean;
    enableFontSize?: boolean;
    actions?: { uploadImages: () => Promise<void>; insertText?: (text: string) => void };
  }>();

  let element: HTMLElement;
  let editor: Editor | undefined = $state();
  let selectionState = $state(0);

  function currentFontSize() {
    const value = editor?.getAttributes("textStyle").fontSize || "";
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : 16;
  }

  function setFontSize(value: number) {
    if (!editor || !Number.isFinite(value)) return;
    const size = Math.min(72, Math.max(8, Math.round(value)));
    editor
      .chain()
      .focus()
      .setMark("textStyle", { fontSize: `${size}px` })
      .run();
  }

  function increaseFontSize() {
    setFontSize(currentFontSize() + 2);
  }

  // Link Dialog State
  let linkDialogOpen = $state(false);
  let linkUrl = $state("");

  // Image Dialog State
  let imageDialogOpen = $state(false);
  let imageUrl = $state("");
  let pendingImageFile = $state<File | Blob | null>(null);
  let imagePreviewUrl = $state<string | null>(null);

  function openImageDialog() {
    imageUrl = "";
    pendingImageFile = null;
    imagePreviewUrl = null;
    imageDialogOpen = true;
  }

  let isUploadingImage = $state(false);
  const pendingImages = new Map<string, Blob>();

  async function uploadImages() {
    if (!editor) return;
    const content = editor.getHTML();
    if (!content.includes("blob:")) return;

    // Parse content to find all blob images
    const doc = new DOMParser().parseFromString(content, "text/html");
    const imgs = Array.from(doc.querySelectorAll("img[src^='blob:']"));

    if (imgs.length === 0) return;

    isUploadingImage = true;
    try {
      for (const img of imgs) {
        const blobUrl = img.getAttribute("src")!;
        const blob = pendingImages.get(blobUrl);
        if (blob) {
          const formData = new FormData();
          formData.append("file", blob, "announcement_image.jpg");

          const data = await fetchServer("/api/upload?type=announcements", {
            method: "POST",
            body: formData
          });

          img.setAttribute("src", data.url);
          pendingImages.delete(blobUrl);
          URL.revokeObjectURL(blobUrl);
        }
      }

      // Update editor with final content
      editor.commands.setContent(doc.body.innerHTML);
    } catch (err: any) {
      console.error(err);
      toast.error("Image upload failed: " + err.message);
      throw err;
    } finally {
      isUploadingImage = false;
    }
  }

  $effect(() => {
    actions = {
      uploadImages,
      insertText: (text: string) => editor?.chain().focus().insertContent(text).run()
    };
  });

  function applyImage() {
    if (pendingImageFile && imagePreviewUrl) {
      pendingImages.set(imagePreviewUrl, pendingImageFile);
      editor?.chain().focus().setImage({ src: imagePreviewUrl }).run();
      imageDialogOpen = false;
      return;
    }
    if (imageUrl) {
      const finalUrl = transformGoogleDriveLink(imageUrl);
      editor?.chain().focus().setImage({ src: finalUrl }).run();
    }
    imageDialogOpen = false;
  }

  onMount(() => {
    editor = new Editor({
      element,
      editable,
      extensions: [
        StarterKit.configure({
          bulletList: false,
          orderedList: false,
          listItem: false
        }),
        BulletList.configure({
          HTMLAttributes: {
            style:
              "margin: 15px 0 15px 0; padding: 0 0 0 35px; display: block; list-style-position: outside; list-style-type: disc;"
          }
        }),
        OrderedList.configure({
          HTMLAttributes: {
            style:
              "margin: 15px 0 15px 0; padding: 0 0 0 35px; display: block; list-style-position: outside; list-style-type: decimal;"
          }
        }),
        ListItem.configure({
          HTMLAttributes: {
            style:
              "margin-bottom: 10px; list-style-type: inherit; line-height: 1.4; font-size: 14px;"
          }
        }),
        Underline,
        Image.configure({
          inline: false,
          HTMLAttributes: {
            style: "max-width: 100%; height: auto; border-radius: 0.5rem; margin: 1.5rem 0;"
          }
        }),
        Link.configure({
          openOnClick: false,
          HTMLAttributes: {
            style: "color: var(--brand); text-decoration: underline; font-weight: 500;"
          }
        }),
        Placeholder.configure({
          placeholder
        }),
        Table.configure({
          resizable: true,
          HTMLAttributes: {
            class: "border-collapse table-fixed w-full"
          }
        }),
        TableRow,
        TableHeader,
        TableCell,
        TextAlign.configure({
          types: ["heading", "paragraph"]
        }),
        Highlight.configure({ multicolor: true }),
        TextStyle,
        ...(enableFontSize ? [FontSizeExtension] : []),
        Color,
        Subscript,
        Superscript,
        TaskList,
        TaskItem.configure({
          nested: true
        })
      ],
      content,
      onUpdate: ({ editor }) => {
        content = editor.getHTML();
        selectionState++;
      },
      onSelectionUpdate: () => {
        selectionState++;
      },
      editorProps: {
        attributes: {
          class: cn(
            "prose prose-sm max-w-none focus:outline-none text-sm text-foreground leading-relaxed",
            editable ? "min-h-100 p-6" : "min-h-0 p-0"
          )
        }
      }
    });

    return () => {
      editor?.destroy();
    };
  });

  $effect(() => {
    if (editor && content !== undefined && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  });

  function openLinkDialog() {
    linkUrl = editor?.getAttributes("link").href || "";
    linkDialogOpen = true;
  }

  function applyLink() {
    if (linkUrl === "") {
      editor?.chain().focus().extendMarkRange("link").unsetLink().run();
    } else {
      editor?.chain().focus().extendMarkRange("link").setLink({ href: linkUrl }).run();
    }
    linkDialogOpen = false;
  }
</script>

<div
  class={editable
    ? "overflow-hidden rounded-xl border bg-card transition-all focus-within:ring-1 focus-within:ring-ring"
    : "w-full"}
>
  <!-- Fixed Toolbar -->
  {#if editable && editor}
    {#key selectionState}
      <div class="flex flex-col border-b bg-muted/50">
        <!-- Text Formatting Toolbar -->
        <div class="flex flex-wrap items-center gap-1 p-2">
          <!-- History -->
          <Button
            variant="ghost"
            size="sm"
            class="size-8 text-muted-foreground hover:bg-muted hover:text-foreground"
            onclick={() => editor?.chain().focus().undo().run()}
            icon={RotateCcw}
            iconClass="size-3.5"
            title="Undo"
          />

          <div class="mx-1 h-4 w-px bg-border"></div>

          <!-- Basic Marks -->
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('bold')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleBold().run()}
            icon={Bold}
            iconClass="size-3.5"
            title="Bold"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('italic')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleItalic().run()}
            icon={Italic}
            iconClass="size-3.5"
            title="Italic"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('underline')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleUnderline().run()}
            icon={UnderlineIcon}
            iconClass="size-3.5"
            title="Underline"
          />
          {#if enableFontSize}
            <div class="ml-1 flex h-8 items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                class="h-8 px-2 font-bold"
                onclick={increaseFontSize}
                title="Increase selected text size">A+</Button
              >
              <input
                aria-label="Font size in pixels"
                class="h-8 w-16 rounded-md border bg-background px-2 text-xs"
                type="number"
                min="8"
                max="72"
                step="1"
                value={currentFontSize()}
                onchange={(event) => setFontSize(Number(event.currentTarget.value))}
              />
              <span class="text-xs text-muted-foreground">px</span>
            </div>
          {/if}

          <!-- Color & Highlight -->
          <Popover.Root>
            <Popover.Trigger>
              <Button
                variant="ghost"
                size="sm"
                class="size-8 transition-colors {editor.isActive('textStyle') &&
                editor.getAttributes('textStyle').color
                  ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
                icon={Palette}
                iconClass="size-3.5"
                title="Text Color"
              />
            </Popover.Trigger>
            <Popover.Content class="w-40 p-2">
              <div class="grid grid-cols-5 gap-1">
                {#each ["inherit", "#ef4444", "#f97316", "#f59e0b", "#10b981", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#000000"] as color}
                  <button
                    class="size-6 rounded-md border border-border transition-transform hover:scale-110"
                    style="background-color: {color === 'inherit' ? 'transparent' : color}"
                    onclick={() => {
                      if (color === "inherit") {
                        editor?.chain().focus().unsetColor().run();
                      } else {
                        editor?.chain().focus().setColor(color).run();
                      }
                    }}
                    title={color}
                  >
                    {#if color === "inherit"}
                      <RotateCcw class="mx-auto size-3" />
                    {/if}
                  </button>
                {/each}
              </div>
            </Popover.Content>
          </Popover.Root>

          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('highlight')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleHighlight().run()}
            icon={Highlighter}
            iconClass="size-3.5"
            title="Highlight"
          />

          <div class="mx-1 h-4 w-px bg-border"></div>

          <!-- Script -->
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('subscript')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleSubscript().run()}
            icon={SubscriptIcon}
            iconClass="size-3.5"
            title="Subscript"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('superscript')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleSuperscript().run()}
            icon={SuperscriptIcon}
            iconClass="size-3.5"
            title="Superscript"
          />

          <div class="mx-1 h-4 w-px bg-border"></div>

          <!-- Alignment -->
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive({ textAlign: 'left' })
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().setTextAlign("left").run()}
            icon={TextAlignStart}
            iconClass="size-3.5"
            title="Align Left"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive({ textAlign: 'center' })
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().setTextAlign("center").run()}
            icon={TextAlignCenter}
            iconClass="size-3.5"
            title="Align Center"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive({ textAlign: 'right' })
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().setTextAlign("right").run()}
            icon={TextAlignEnd}
            iconClass="size-3.5"
            title="Align Right"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive({ textAlign: 'justify' })
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().setTextAlign("justify").run()}
            icon={TextAlignJustify}
            iconClass="size-3.5"
            title="Justify"
          />

          <div class="grow"></div>

          <!-- Utilities -->
          <Button
            variant="ghost"
            size="sm"
            class="size-8 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onclick={() => editor?.chain().focus().clearNodes().unsetAllMarks().run()}
            title="Clear formatting"
            icon={RotateCcw}
            iconClass="size-3.5"
          />
        </div>

        <!-- Content Elements Row -->
        <div class="flex flex-wrap items-center gap-1 border-t bg-muted/10 p-2">
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('bulletList')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleBulletList().run()}
            icon={List}
            iconClass="size-3.5"
            title="Bullet List"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('orderedList')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleOrderedList().run()}
            icon={ListOrdered}
            iconClass="size-3.5"
            title="Ordered List"
          />
          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('taskList')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() => editor?.chain().focus().toggleTaskList().run()}
            icon={SquareCheckBig}
            iconClass="size-3.5"
            title="Task List"
          />

          <div class="mx-1 h-4 w-px bg-border"></div>

          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('table')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={() =>
              editor?.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}
            icon={TableIcon}
            iconClass="size-3.5"
            title="Insert Table"
          />

          <div class="mx-1 h-4 w-px bg-border"></div>

          <Button
            variant="ghost"
            size="sm"
            class="size-8 transition-colors {editor.isActive('link')
              ? 'border-border bg-background text-foreground shadow-sm ring-1 ring-border'
              : 'text-muted-foreground hover:bg-muted hover:text-foreground'}"
            onclick={openLinkDialog}
            icon={LinkIcon}
            iconClass="size-3.5"
            title="Link"
          />
          {#if editor.isActive("link")}
            <Button
              variant="ghost"
              size="sm"
              class="size-8 text-destructive hover:bg-destructive/10"
              onclick={() => editor?.chain().focus().unsetLink().run()}
              icon={Unlink}
              iconClass="size-3.5"
              title="Unlink"
            />
          {/if}

          <Button
            variant="ghost"
            size="sm"
            class="size-8 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onclick={openImageDialog}
            icon={ImageIcon}
            iconClass="size-3.5"
            title="Insert Image"
          />
        </div>

        <!-- Table Row Modification Row -->
        {#if editor.isActive("table")}
          <div class="flex flex-wrap items-center gap-1 border-t bg-muted/20 p-2">
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().addColumnBefore().run()}
            >
              <Columns2 class="size-3" /> Col Before
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().addColumnAfter().run()}
            >
              <Columns2 class="size-3" /> Col After
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().deleteColumn().run()}
            >
              <Trash2 class="size-3" /> Del Col
            </Button>

            <div class="mx-1 h-4 w-px bg-border"></div>

            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().addRowBefore().run()}
            >
              <Rows2 class="size-3" /> Row Before
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().addRowAfter().run()}
            >
              <Rows2 class="size-3" /> Row After
            </Button>
            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onclick={() => editor?.chain().focus().deleteRow().run()}
            >
              <Trash2 class="size-3" /> Del Row
            </Button>

            <div class="mx-1 h-4 w-px bg-border"></div>

            <Button
              variant="ghost"
              size="sm"
              class="h-8 gap-2 px-2 text-xs text-destructive hover:bg-destructive/10"
              onclick={() => editor?.chain().focus().deleteTable().run()}
            >
              <Trash2 class="size-3" /> Delete Table
            </Button>
          </div>
        {/if}
      </div>
    {/key}
  {/if}

  <!-- Editor Container -->
  <RichTextWrapper>
    <div
      bind:this={element}
      class="tiptap-container border-0 {editable ? 'min-h-100' : 'min-h-0'}"
    ></div>
  </RichTextWrapper>
</div>

<!-- Link Dialog -->
<Dialog.Root bind:open={linkDialogOpen}>
  <Dialog.Content class="sm:max-w-106.25">
    <Dialog.Header>
      <Dialog.Title>Edit Link</Dialog.Title>
      <Dialog.Description>
        Enter the URL for the selected text. Leave empty to remove link.
      </Dialog.Description>
    </Dialog.Header>
    <div class="grid gap-4 py-4">
      <div class="grid gap-2">
        <Label for="url">URL</Label>
        <Input
          id="url"
          placeholder="https://example.com"
          bind:value={linkUrl}
          onkeydown={(e) => e.key === "Enter" && applyLink()}
        />
      </div>
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (linkDialogOpen = false)}>Cancel</Button>
      <Button type="submit" onclick={applyLink}>Apply</Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<Dialog.Root bind:open={imageDialogOpen}>
  <Dialog.Content class="sm:max-w-106.25">
    <Dialog.Header>
      <Dialog.Title>Insert Image</Dialog.Title>
    </Dialog.Header>
    <div class="py-4">
      <ImageUpload
        bind:value={imageUrl}
        bind:file={pendingImageFile}
        bind:previewUrl={imagePreviewUrl}
        allowUrl={true}
      />
    </div>
    <Dialog.Footer>
      <Button variant="outline" onclick={() => (imageDialogOpen = false)}>Cancel</Button>
      <Button
        type="submit"
        onclick={applyImage}
        disabled={!imageUrl && !pendingImageFile && !imagePreviewUrl}
      >
        Insert
      </Button>
    </Dialog.Footer>
  </Dialog.Content>
</Dialog.Root>

<script lang="ts">
  let { children } = $props();
</script>

{@render children()}

<style>
  :global(.tiptap p.is-editor-empty:first-child::before) {
    color: #adb5bd;
    content: attr(data-placeholder);
    float: left;
    height: 0;
    pointer-events: none;
  }

  /* An empty paragraph serializes to a bare <p></p>, which renders at zero
     height once Tailwind's preflight resets paragraph margins — blank
     separator lines typed in the editor would vanish for readers. em-based so
     the gap scales with the surrounding prose size. */
  :global(.tiptap p:empty) {
    min-height: 1.5em;
  }

  :global(.tiptap ul) {
    list-style-type: disc !important;
    padding-left: 1.5rem !important;
    margin: 1rem 0 !important;
  }

  :global(.tiptap ol) {
    list-style-type: decimal !important;
    padding-left: 1.5rem !important;
    margin: 1rem 0 !important;
  }

  :global(.tiptap li) {
    margin: 0.25rem 0 !important;
  }

  :global(.tiptap a) {
    color: var(--brand);
    text-decoration: underline;
    font-weight: 500;
  }

  :global(.tiptap table) {
    border-collapse: collapse;
    table-layout: fixed;
    width: 100%;
    margin: 0;
    overflow: hidden;
  }

  :global(.tiptap table td, .tiptap table th) {
    min-width: 1em;
    border: 1px solid var(--border);
    padding: 3px 5px;
    vertical-align: top;
    box-sizing: border-box;
    position: relative;
  }

  :global(.tiptap table td > *, .tiptap table th > *) {
    margin-bottom: 0;
  }

  :global(.tiptap table th) {
    font-weight: bold;
    text-align: left;
    background-color: var(--muted);
  }

  :global(.tiptap table .selectedCell:after) {
    z-index: 2;
    position: absolute;
    content: "";
    left: 0;
    right: 0;
    top: 0;
    bottom: 0;
    background: rgba(200, 200, 255, 0.4);
    pointer-events: none;
  }

  :global(.tiptap table .column-resize-handle) {
    position: absolute;
    right: -2px;
    top: 0;
    bottom: -2px;
    width: 4px;
    background-color: var(--brand);
    pointer-events: none;
  }

  :global(.tiptap .tableWrapper) {
    overflow-x: auto;
    margin: 1.5rem 0;
  }

  :global(.tiptap ul[data-type="taskList"]) {
    list-style: none !important;
    padding: 0 !important;
  }

  :global(.tiptap ul[data-type="taskList"] li) {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    margin-bottom: 0.25rem !important;
  }

  :global(.tiptap ul[data-type="taskList"] li > label) {
    flex: 0 0 auto;
    user-select: none;
    margin-top: 0.25rem;
  }

  :global(.tiptap ul[data-type="taskList"] li > div) {
    flex: 1 1 auto;
  }

  :global(.tiptap ul[data-type="taskList"] input[type="checkbox"]) {
    cursor: pointer;
  }
</style>

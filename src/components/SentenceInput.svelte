<script lang="ts">
  let {
    text = $bindable(),
    busy = false,
    onparse,
  }: {
    text: string
    busy?: boolean
    onparse: () => void
  } = $props()
</script>

<form
  class="sentence-input"
  onsubmit={(e) => {
    e.preventDefault()
    if (text.trim()) onparse()
  }}
>
  <textarea
    bind:value={text}
    lang="ja"
    rows="3"
    placeholder="日本語の文を入力してください…"
    aria-label="日本語の文を入力 — Japanese text to parse"
  ></textarea>
  <button type="submit" disabled={busy || !text.trim()}>解析 Parse</button>
</form>

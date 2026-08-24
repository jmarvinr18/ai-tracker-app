<script setup lang="ts">
/**
 * An empty state names the next action.
 *
 * "No data" tells a reader that something is missing but not whether it is
 * broken, whose job it is, or what to do — so this component makes the action
 * a required prop rather than an optional flourish.
 */
defineProps<{
  /** What is not here yet. */
  headline: string
  /** The next action. Required by design. */
  action: string
}>()
</script>

<template>
  <div class="empty">
    <p class="empty__headline">{{ headline }}</p>
    <p class="empty__action">{{ action }}</p>
  </div>
</template>

<style scoped>
.empty {
  border: 1px dashed var(--rule);
  border-radius: var(--radius);
  padding: var(--step-4);
  background: var(--paper);
  display: grid;
  gap: var(--step-1);
}

.empty__headline {
  font-family: var(--font-display);
  font-size: 0.9375rem;
  color: var(--ink);
}

.empty__action {
  font-size: 0.8125rem;
  color: var(--ink-soft);
  max-width: 60ch;
}
</style>

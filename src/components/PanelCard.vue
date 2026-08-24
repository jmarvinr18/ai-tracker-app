<script setup lang="ts">
defineProps<{
  title: string
  /** A quiet line under the title: provenance, caveats, how to read it. */
  note?: string
}>()
</script>

<template>
  <section class="panel">
    <header class="panel__head">
      <div>
        <h2 class="panel__title">{{ title }}</h2>
        <p v-if="note" class="panel__note">{{ note }}</p>
      </div>
      <slot name="actions" />
    </header>
    <slot />
  </section>
</template>

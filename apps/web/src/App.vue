<template>
  <div class="pb-16">
    <RouterView />
  </div>
  <TabBar />
</template>

<script setup lang="ts">
import { RouterView } from 'vue-router'
import TabBar from '@/components/TabBar.vue'
</script>

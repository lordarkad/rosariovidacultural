<template>
  <div :class="{ 'pb-16': !hideTabBar }">
    <RouterView />
  </div>
  <TabBar v-if="!hideTabBar" />
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { RouterView, useRoute } from 'vue-router'
import TabBar from '@/components/TabBar.vue'

// `/curacion/*` es interna: sin la tab bar del sitio
const route = useRoute()
const hideTabBar = computed(() => route.meta.hideTabBar === true)
</script>

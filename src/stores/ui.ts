import { defineStore } from 'pinia';
import { ref } from 'vue';

export const useUiStore = defineStore('ui', () => {
  const sidebarOpen = ref(true);
  const propertiesPanelOpen = ref(true);
  const selectedNodeId = ref<string | null>(null);

  function toggleSidebar() {
    sidebarOpen.value = !sidebarOpen.value;
  }

  function togglePropertiesPanel() {
    propertiesPanelOpen.value = !propertiesPanelOpen.value;
  }

  function selectNode(id: string | null) {
    selectedNodeId.value = id;
  }

  return {
    sidebarOpen,
    propertiesPanelOpen,
    selectedNodeId,
    toggleSidebar,
    togglePropertiesPanel,
    selectNode,
  };
});

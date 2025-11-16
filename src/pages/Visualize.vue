<template>
  <div>
    <div class="visualize-container">
      <h1>Setting</h1>
      <div class="setting-container">
        <h3>Volume</h3>
        <bm-slider></bm-slider>
      </div>
      <div class="setting-container">
        <h3>Volume</h3>
        <bm-slider></bm-slider>
      </div>
      <div class="setting-container">
        <h3>Volume</h3>
        <bm-slider></bm-slider>
      </div>
      <div class="setting-container">
        <h3>Volume</h3>
        <bm-slider></bm-slider>
      </div>
      <div class="setting-container">
        <h3>Volume</h3>
        <bm-slider></bm-slider>
      </div>
      <div class="btn-container"
        style="display: inline-flex; flex-direction: row; align-items: center; justify-content: center;gap: 50px;position: absolute;bottom: 50px;">
        <bm-button>保存</bm-button>
        <bm-button @click="closeSettingWindow">取消</bm-button>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">


function closeSettingWindow() {
  window.electronAPI.closeSettingWindow()
}
</script>
<style scoped>
.visualize-container {
  height: 100%;
  background-color: #ffffff;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.setting-container {
  width: 600px;
  display: inline-flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
}

.setting-container h3 {
  width: 100px;
  height: 20px;
}
</style>

<template>

  {{ dot1Left }}

  <div class="effect" :class="`set${currentSet}`">
    <div class="side left" :style="`opacity: ${dot1Left}`"></div>
    <div class="side right" :style="`opacity: ${dot1Left}`"></div>
    <div class="side top" :style="`opacity: ${dot1Left}`"></div>
    <div class="side bottom" :style="`opacity: ${dot1Left}`"></div>
  </div>
  <div class="highlight" :class="`set${currentSet}`">
    <div class="side left" :style="`opacity: ${dot1Left}`"></div>
    <div class="side right" :style="`opacity: ${dot1Left}`"></div>
    <div class="side top" :style="`opacity: ${dot1Left}`"></div>
    <div class="side bottom" :style="`opacity: ${dot1Left}`"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue';
const dot1Left = ref(15);
import '@/style/color/index.css';
const currentSet = ref(1);
const allSources = ref([]); // 所有屏幕源
const mainSource = ref(null); // 主屏幕源
const selectedSourceId = ref(null); // 选中的屏幕源ID
const status = ref('状态：未开始捕获'); // 状态文本

const isCapturing = ref(false); // 是否正在捕获

const audioStream = ref(null); // 音视频流
const audioContext = ref(null); // 音频上下文
const analyserNode = ref(null); // 音频分析器
const animationId = ref(null); // 动画帧ID（用于停止绘制）


// 4. 初始化：获取屏幕源列表（组件挂载后执行）
onMounted(async () => {

  await initSourceList().then(() => {
    startCapture();
  });
});


onBeforeUnmount(() => {
  stopCapture();
  if (animationId.value) {
    cancelAnimationFrame(animationId.value);
  }
});


async function initSourceList() {
  try {
    status.value = '状态：正在获取屏幕源...';
    // 调用预加载脚本暴露的 Electron API
    const { mainSource: resMainSource, allSources: resAllSources } =
      await window.electronAPI.getDesktopSources();

    // 校验数据有效性
    if (!resAllSources || resAllSources.length === 0) {
      status.value = '错误：未检测到可用屏幕源（检查系统权限或桌面环境）';
      return;
    }

    // 格式化数据（NativeImage 已在主进程转为 dataURL）
    const formattedSources = resAllSources.map((source) => ({
      id: source.id,
      name: source.name,
      thumbnailUrl: source.thumbnailUrl,
    }));

    // 更新响应式状态
    allSources.value = formattedSources;
    mainSource.value = {
      id: resMainSource.id,
      name: resMainSource.name,
      thumbnailUrl: resMainSource.thumbnailUrl,
    };
    selectedSourceId.value = mainSource.value.id;
    status.value = `状态：默认选中主屏幕：${mainSource.value.name}`;
  } catch (error) {
    status.value = `错误：获取屏幕源失败：${error.message}`;
    console.error('Vue 组件获取屏幕源失败：', error);
  }
}

// 7. 核心方法：开始捕获系统音频
async function startCapture() {
  if (!selectedSourceId.value) {
    status.value = '错误：请先选择一个屏幕源';
    return;
  }

  try {
    isCapturing.value = true;
    status.value = '状态：正在捕获系统音频...';

    // 配置 getUserMedia 约束（与原生一致）
    const constraints = {
      audio: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: selectedSourceId.value,
        },
        optional: [],
      },
      video: {
        mandatory: {
          chromeMediaSource: 'desktop',
          chromeMediaSourceId: selectedSourceId.value,
          minWidth: 1280,
          minHeight: 720,
          maxWidth: 1280,
          maxHeight: 720,
        },
      },
    };

    // 获取音视频流
    audioStream.value = await navigator.mediaDevices.getUserMedia(constraints);
    status.value = '状态：音频捕获成功！正在初始化可视化...';

    // 关闭视频轨道（仅保留音频）
    audioStream.value.getVideoTracks().forEach((track) => {
      track.stop();
      console.log('视频轨道已关闭，仅保留音频');
    });

    // 初始化音频可视化
    await initAudioVisualization();
  } catch (error) {
    isCapturing.value = false;
    status.value = `错误：捕获音频失败：${error.message}`;
    console.error('Vue 组件音频捕获失败：', error);

    // 常见错误补充提示
    if (error.name === 'NotAllowedError') {
      status.value += '（请检查系统“屏幕录制”权限，授权后重启应用）';
    } else if (error.name === 'NotFoundError') {
      status.value += '（未检测到可用的音频源，检查系统音频设备）';
    }
  }
}

// 8. 核心方法：初始化音频可视化
function initAudioVisualization() {
  // 创建 AudioContext
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  audioContext.value = new AudioContext();

  // 激活 AudioContext（浏览器限制：需用户交互后激活）
  if (audioContext.value.state === 'suspended') {
    audioContext.value.resume();
  }

  // 创建媒体流源节点
  const sourceNode = audioContext.value.createMediaStreamSource(audioStream.value);

  // 配置分析器节点
  analyserNode.value = audioContext.value.createAnalyser();
  analyserNode.value.fftSize = 512;
  analyserNode.value.smoothingTimeConstant = 0.8;

  // 连接音频节点
  sourceNode.connect(analyserNode.value);
  // analyserNode.value.connect(audioContext.value.destination); // 取消注释可播放音频

  // 开始绘制频谱
  drawSpectrum();
}
const rhythmOptConfig = {
  lowFreqRange: [0, 100],    // 锁定低频段（节奏核心）
  peakWindowSize: 20,       // 滑动窗口大小
  nonLinearPower: 2.5,      // 非线性放大指数
  decayRate: 0.88,          // 衰减速率
  minValue: 0.05,           // 最小透明度
  maxValue: 1.0,            // 最大透明度
  delay: 400,               // 延迟时间（ms），适配蓝牙耳机（100-300ms 按需调整）
  frameRate: 60             // 预估帧率
};


const rhythmDataQueue = ref([]);

// 9. 核心方法：绘制音频频谱图（新增延迟逻辑）
function drawSpectrum() {
  if (!analyserNode.value) return;

  // 获取频率数据
  const bufferLength = analyserNode.value.frequencyBinCount;
  const frequencyData = new Uint8Array(bufferLength);
  analyserNode.value.getByteFrequencyData(frequencyData);
  const { lowFreqRange, peakWindowSize, nonLinearPower, decayRate, minValue, maxValue, delay, frameRate } = rhythmOptConfig;
  const [lowStart, lowEnd] = lowFreqRange;

  // 1. 提取低频段数据，计算平均值（原有逻辑不变）
  const lowData = frequencyData.slice(lowStart, lowEnd);
  if (lowData.length === 0) {
    animationId.value = requestAnimationFrame(drawSpectrum);
    return;
  }
  const lowAvg = lowData.reduce((sum, val) => sum + val, 0) / lowData.length;

  // 2. 滑动窗口记录历史峰值（原有逻辑不变）
  peakHistory.value.push(lowAvg);
  if (peakHistory.value.length > peakWindowSize) {
    peakHistory.value.shift();
  }
  currentPeak = Math.max(...peakHistory.value) || 1; // 避免除以0

  // 3. 归一化 + 非线性放大（原有逻辑不变）
  let normalized = lowAvg / currentPeak;
  normalized = Math.pow(normalized, nonLinearPower);


  const currentTimestamp = Date.now();
  rhythmDataQueue.value.push({
    timestamp: currentTimestamp,
    value: normalized
  });


  let delayedValue = normalized;
  if (delay > 0) {
    // 计算需要取的历史数据的时间戳（当前时间 - 延迟时间）
    const targetTimestamp = currentTimestamp - delay;
    // 从队列中找到第一个时间戳 ≥ targetTimestamp 的数据（最接近延迟时间的旧数据）
    const targetIndex = rhythmDataQueue.value.findIndex(item => item.timestamp >= targetTimestamp);

    if (targetIndex !== -1) {
      // 找到目标数据，使用该数据
      delayedValue = rhythmDataQueue.value[targetIndex].value;
      // 清理队列中过期的旧数据（早于targetTimestamp的都可以删，节省内存）
      rhythmDataQueue.value.splice(0, targetIndex);
    } else if (rhythmDataQueue.value.length > 0) {
      // 队列中没有足够老的数据（比如刚启动时），用队列中最旧的数据（避免空白）
      delayedValue = rhythmDataQueue.value[0].value;
    }
  } else {
    // 延迟为0，清空队列（避免冗余数据）
    rhythmDataQueue.value = [];
  }

  // 4. 衰减动画（修改：用延迟后的值更新dot1Left）
  dot1Left.value = Math.max(
    minValue,
    dot1Left.value * decayRate + delayedValue * (1 - decayRate)
  );

  // 5. 限制在0-1范围（原有逻辑不变）
  dot1Left.value = Math.min(maxValue, dot1Left.value);
  dot1Left.value = Math.max(minValue, dot1Left.value);


  const maxQueueLength = Math.ceil((delay * frameRate) / 1000) + 10; // 多留10帧缓冲
  if (rhythmDataQueue.value.length > maxQueueLength) {
    rhythmDataQueue.value.splice(0, rhythmDataQueue.value.length - maxQueueLength);
  }

  // 循环绘制（存储动画ID，用于后续停止）
  animationId.value = requestAnimationFrame(drawSpectrum);
}


function stopCapture() {
  // 停止动画帧
  if (animationId.value) {
    cancelAnimationFrame(animationId.value);
    animationId.value = null;
  }

  // 关闭音频流
  if (audioStream.value) {
    audioStream.value.getTracks().forEach((track) => track.stop());
    audioStream.value = null;
  }

  // 关闭音频上下文
  if (audioContext.value) {
    audioContext.value.close();
    audioContext.value = null;
  }


  // 更新状态
  isCapturing.value = false;
  status.value = '状态：已停止捕获音频';

  rhythmDataQueue.value = []; // 清空延迟队列
  peakHistory.value = [];     // 清空峰值历史
  currentPeak = 0;
  dot1Left.value = rhythmOptConfig.minValue; // 重置透明度
}

const peakHistory = ref([]); // 滑动窗口峰值历史
let currentPeak = 0; // 当前窗口的基准峰值





</script>

<style scoped>
* {
  transition: all 0s ease-in-out;
}

.container {
  max-width: 900px;
  margin: 0 auto;
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  font-family: Arial, sans-serif;
}

.permission-tip {
  margin: 10px 0;
  padding: 10px;
  background: #fff3cd;
  border-radius: 4px;
  font-size: 13px;
  color: #856404;
}

.source-selector {
  margin: 20px 0;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
}

.source-item {
  display: inline-block;
  margin: 10px;
  padding: 10px;
  border: 2px solid transparent;
  border-radius: 4px;
  cursor: pointer;
}

.source-item.active {
  border-color: #007bff;
}

.source-item img {
  width: 150px;
  height: 112px;
  object-fit: cover;
}

.source-item p {
  text-align: center;
  margin-top: 5px;
  font-size: 13px;
  margin: 0;
}

.btn-group {
  margin-bottom: 20px;
}

button {
  padding: 12px 24px;
  font-size: 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 10px;
}

#startBtn {
  background: #28a745;
  color: white;
}

#startBtn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

#stopBtn {
  background: #dc3545;
  color: white;
}

.status {
  margin: 15px 0;
  color: #666;
  font-size: 14px;
}

#audioCanvas {
  width: 100%;
  height: 300px;
  background: #000;
  border-radius: 4px;
}

h1 {
  margin-bottom: 20px;
  color: #333;
}

h4 {
  margin: 0 0 10px 0;
  color: #444;
}

.dot {
  position: fixed;
  top: 2%;
  left: -700px;
  width: 800px;
  height: 80vh;
  background-image: radial-gradient(circle, #6c73ff 0%, #ff990000 60%);
  pointer-events: none;
}

.effect {
  position: fixed;
  height: 100vh;
  width: 100vw;
  top: 0;
  left: 0;
  pointer-events: none;
}

.side {
  position: fixed;
  pointer-events: none;
  filter: blur(40px);
  animation: moveDot 2s linear infinite;
}

.left {
  top: 0;
  left: 0;
  width: 20px;
  height: 100vh;
  background-image: linear-gradient(0deg,
      var(--color-1) 0%,
      var(--color-2) 20%,
      var(--color-3) 40%,
      var(--color-4) 60%,
      var(--color-5) 100%);

}

.right {
  top: 0;
  right: 0;
  width: 20px;
  height: 100vh;
  background-image: linear-gradient(180deg,
      var(--color-1) 0%,
      var(--color-4) 40%,
      var(--color-1) 60%,
      var(--color-3) 100%);

}

.top {
  top: 0;
  left: 0;
  width: 100vw;
  height: 20px;
  background-image: linear-gradient(90deg,
      var(--color-5) 0%,
      var(--color-4) 20%,
      var(--color-3) 40%,
      var(--color-2) 60%,
      var(--color-1) 100%);

}

.bottom {
  bottom: 0;
  left: 0;
  width: 100vw;
  height: 20px;
  background-image: linear-gradient(90deg,
      var(--color-1) 0%,
      var(--color-2) 20%,
      var(--color-3) 40%,
      var(--color-4) 60%,
      var(--color-5) 100%);

}

.highlight .left {
  top: 0;
  left: 0;
  width: 10px;
  height: 100vh;
  background-image: linear-gradient(0deg,
      var(--color-1) 0%,
      var(--color-2) 20%,
      var(--color-3) 40%,
      var(--color-4) 60%,
      var(--color-5) 100%);

}

.highlight .right {
  top: 0;
  right: 0;
  width: 10px;
  height: 100vh;
  background-image: linear-gradient(180deg,
      var(--color-1) 0%,
      var(--color-4) 40%,
      var(--color-2) 60%,
      var(--color-3) 100%);

}

.highlight .top {
  top: 0;
  left: 0;
  width: 100vw;
  height: 10px;
  background-image: linear-gradient(90deg,
      var(--color-5) 0%,
      var(--color-4) 20%,
      var(--color-3) 40%,
      var(--color-2) 60%,
      var(--color-1) 100%);

}

.highlight .bottom {
  bottom: 0;
  left: 0;
  width: 100vw;
  height: 15px;
  background-image: linear-gradient(90deg,
      var(--color-1) 0%,
      var(--color-2) 20%,
      var(--color-3) 40%,
      var(--color-4) 60%,
      var(--color-5) 100%);

}


.highlight .left,
.highlight .right {
  filter: brightness(0.7) saturate(3.0) blur(2px);
  width: 5px;
  opacity: 1;
}

.highlight .top,
.highlight .bottom {
  filter: brightness(0.7) saturate(3.0) blur(2px);
  height: 4px;
  opacity: 1;
}

@keyframe moveDot {
  0% {
    transform: translate(0, 0);
  }

  40% {
    transform: translate(-50vw, -50vh);
  }

  60% {
    transform: translate(50vw, 50vh);
  }

  100% {
    transform: translate(0, 0);
  }

}
</style>

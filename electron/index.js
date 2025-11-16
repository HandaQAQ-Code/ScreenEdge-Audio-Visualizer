import path from 'path'
import { fileURLToPath } from 'url'
import fs from 'fs'
import { app, BrowserWindow, ipcMain, desktopCapturer, screen, Tray, Menu } from 'electron'

let mainWindow = null
let settingWindow = null
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// 避免多实例冲突
if (!app.requestSingleInstanceLock()) {
  app.quit()
}

// 创建窗口函数（不变）
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 800,
    title: '系统音频捕获 + 可视化',
    transparent: true,
    frame: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  mainWindow.loadURL('http://localhost:5173')

  mainWindow.setIgnoreMouseEvents(true)
  mainWindow.setFullScreen(true)
  mainWindow.setAlwaysOnTop(true)
  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

// 创建设置窗口函数
function createSettingWindow() {
  settingWindow = new BrowserWindow({
    width: 800,
    height: 600,
    title: '设置',
    resizable: false,
    show: false,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      preload: path.join(__dirname, 'preload.js'),
    },
  })

  settingWindow.loadURL('http://localhost:5173/setting')

  settingWindow.setAlwaysOnTop(true)
  settingWindow.on('closed', () => {
    settingWindow = null
  })
}

let tray = null
// 系统托盘魔法阵
function createTray() {
  const iconPath = path.join(__dirname, 'icon.png')

  tray = new Tray(iconPath)

  // 右键菜单配置
  const contextMenu = Menu.buildFromTemplate([
    {
      label: '双击图标显示窗口',
    },
    {
      label: '设置',
      click: () => settingWindow.show(),
    },
    {
      label: '彻底退出',
      click: () => {
        app.exit()
      },
    },
  ])

  tray.setToolTip('你的隐形助手')
  tray.setContextMenu(contextMenu)

  // 单击显示/隐藏窗口
  tray.on('click', () => {
    mainWindow.isVisible() ? mainWindow.hide() : mainWindow.show()
  })
}

// 保证单实例运行的防护盾
app.requestSingleInstanceLock()

// IPC 方法：修复后，screen 已定义
ipcMain.handle('get-desktop-sources', async (event, options) => {
  try {
    // 1. 获取屏幕源（types 强制为 screen）
    const sources = await desktopCapturer.getSources({
      ...options,
      types: ['screen'],
      thumbnailSize: { width: 200, height: 150 },
      fetchWindowIcons: false, // 屏幕源不需要窗口图标，提升性能
    })

    // 2. 校验 sources 有效性
    if (!Array.isArray(sources) || sources.length === 0) {
      throw new Error(
        '未检测到屏幕源，请按以下步骤排查：\n' +
          '1. 确认系统已授予“屏幕录制”权限（授权后需重启应用）；\n' +
          '2. Linux 系统需切换到 X11 桌面（Wayland 不兼容）；\n' +
          '3. 检查显示器是否正常连接（多屏请断开多余显示器测试）；\n' +
          '4. 升级 Electron 到 v13+ 版本',
      )
    }

    // 3. 安全获取主屏幕源（兜底逻辑）
    const mainDisplay = screen.getPrimaryDisplay()
    let mainScreenSource = sources.find((source) => {
      // 兼容部分 Electron 版本中 displayId 为字符串的情况
      return String(source.displayId) === String(mainDisplay.id)
    })
    if (!mainScreenSource) {
      mainScreenSource = sources[0]
      console.warn(
        `主屏幕源匹配失败（displayId: ${mainDisplay.id}），默认使用第一个屏幕源：${mainScreenSource.name}`,
      )
    }

    // 4. 返回有效数据（无 undefined）
    return {
      mainSource: mainScreenSource,
      allSources: sources.filter((source) => source && source.id), // 过滤无效源
    }
  } catch (error) {
    console.error('主进程获取桌面源失败：', error.stack)
    throw error // 抛出错误，让渲染进程显示给用户
  }
})
ipcMain.on('close-setting-window', () => {
  settingWindow.close()
})

// 启动应用（带错误捕获）
app
  .whenReady()
  .then(createWindow)
  .then(createSettingWindow)
  .then(createTray)
  .catch((error) => {
    console.error('应用启动失败：', error.message)
    app.quit()
  })
const rhythmOptConfig = {
  lowFreqRange: [0, 255],
  peakWindowSize: 60,
  nonLinearPower: 2,
  decayRate: 0.92,
  minValue: 0.05,
  maxValue: 0.8,
}

function saveConfig() {
  // 将配置 JSON 写入本地文件（贝蒂：即本地磁盘）
  const filePath = path.join(__dirname, '..', 'userdata', 'config.json')
  try {
    // 确保 userdata 目录存在，没有则创建
    const dir = path.dirname(filePath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(filePath, JSON.stringify(rhythmOptConfig, null, 2), 'utf8')
  } catch (err) {
    console.error('保存配置文件失败：', err)
  }
}
saveConfig()

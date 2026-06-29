const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, powerMonitor, shell } = require('electron')
const path = require('path')
const Store = require('electron-store')

// 初始化本地存储
const store = new Store()

// 应用图标路径：dev 用 public/，打包后用 dist/（vite 构建时已把 public 复制到 dist）
const isDev = process.env.NODE_ENV === 'development'
const iconPath = path.join(__dirname, isDev ? '../public/icon.png' : '../dist/icon.png')

// 开机自启时由 setLoginItemSettings 的 args 注入 --hidden，据此静默启动（不弹出主窗口）
const startHidden = process.argv.includes('--hidden')

// 主窗口
let mainWindow = null
// 宠物窗口
let petWindow = null
// 托盘图标
let tray = null
// 是否正在退出应用（区分“真正退出”和“关闭按钮最小化到托盘”）
let isQuitting = false

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 640,
    resizable: false,
    show: false,
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 隐藏默认菜单栏
  mainWindow.setMenuBarVisibility(false)

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 关闭时最小化到托盘（除非正在退出）
  mainWindow.on('close', (event) => {
    const settings = store.get('settings', {})
    if (!isQuitting && settings.closeToTray !== false) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('ready-to-show', () => {
    // 开机自启（--hidden）时不显示主窗口，隐藏到托盘；由托盘点击唤出
    if (!startHidden) {
      mainWindow.show()
    }
  })
}

// 创建宠物窗口（透明，始终置顶）
function createPetWindow() {
  const { width, height } = screen.getPrimaryDisplay().workAreaSize

  petWindow = new BrowserWindow({
    width: width,
    height: height,
    x: 0,
    y: 0,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env.NODE_ENV === 'development') {
    petWindow.loadURL('http://localhost:5173/pet.html')
  } else {
    petWindow.loadFile(path.join(__dirname, '../dist/pet.html'))
  }

  // 让透明区域点击穿透（forward:true 允许 mousemove 事件传递）
  petWindow.setIgnoreMouseEvents(true, { forward: true })

  // 动态切换点击穿透：当鼠标在宠物/气泡上时可交互，其他区域穿透
  ipcMain.on('set-pet-interactable', (_event, interactable) => {
    if (petWindow && !petWindow.isDestroyed()) {
      if (interactable) {
        petWindow.setIgnoreMouseEvents(false)
      } else {
        petWindow.setIgnoreMouseEvents(true, { forward: true })
      }
    }
  })

  petWindow.on('closed', () => {
    petWindow = null
  })
}

// 创建托盘图标
function createTray() {
  // 尝试加载图标文件
  let icon
  try {
    icon = nativeImage.createFromPath(iconPath)
    if (icon.isEmpty()) throw new Error('empty')
  } catch {
    // 生成一个简单的 16x16 蓝色圆形图标
    icon = createDefaultIcon()
  }

  tray = new Tray(icon.resize({ width: 16, height: 16 }))
  updateTrayMenu()
  tray.setToolTip('提醒小助手')

  tray.on('click', () => {
    if (mainWindow) mainWindow.show()
  })

  tray.on('double-click', () => {
    if (mainWindow) mainWindow.show()
  })
}

// 生成默认托盘图标（蓝色圆形）
function createDefaultIcon() {
  const size = 32
  const canvas = require('electron').nativeImage.createEmpty()

  // 使用一个简单的 SVG 转换为 PNG
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="#409eff" stroke="#fff" stroke-width="1"/>
    <text x="${size/2}" y="${size/2 + 4}" text-anchor="middle" fill="#fff" font-size="14" font-weight="bold">⏰</text>
  </svg>`

  // 用 data URL 创建
  const svgBuffer = Buffer.from(svg)
  return nativeImage.createFromBuffer(svgBuffer)
}

// 更新托盘菜单
function updateTrayMenu() {
  const settings = store.get('settings', {})
  const isPaused = settings.globalPaused || false

  // 计算下一个提醒信息
  const nextInfo = getNextReminderInfo(settings)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '⏰ 提醒小助手',
      enabled: false
    },
    { type: 'separator' },
    {
      label: isPaused ? '▶ 恢复提醒' : '⏸ 暂停提醒',
      click: () => {
        const s = store.get('settings', {})
        const newPaused = !s.globalPaused
        store.set('settings', { ...s, globalPaused: newPaused })
        if (mainWindow) {
          mainWindow.webContents.send('pause-state-changed', newPaused)
        }
        updateTrayMenu()
      }
    },
    {
      label: '跳到下一个提醒',
      click: () => {
        if (mainWindow) {
          mainWindow.webContents.send('trigger-next-reminder')
        }
      }
    },
    { type: 'separator' },
    {
      label: nextInfo || '无活跃提醒',
      enabled: false
    },
    { type: 'separator' },
    {
      label: '显示主窗口',
      click: () => {
        if (mainWindow) mainWindow.show()
      }
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        // 标记正在退出：close 事件据此放行（真正关闭），不再 hide 已 null 的窗口
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setContextMenu(contextMenu)
}

// 计算下一个提醒信息
function getNextReminderInfo(settings) {
  const reminders = settings.reminders || []
  const enabledReminders = reminders.filter(r => r.enabled)
  if (enabledReminders.length === 0) return null

  let nearest = null
  let nearestTime = Infinity

  const now = Date.now()
  for (const r of enabledReminders) {
    const last = r.lastTriggered ? new Date(r.lastTriggered).getTime() : 0
    const targetMs = r.interval * 60 * 1000
    const remaining = targetMs - (now - last)
    if (remaining < nearestTime) {
      nearestTime = remaining
      nearest = r
    }
  }

  if (!nearest) return null

  const minutesLeft = Math.max(0, Math.ceil(nearestTime / 60000))
  return `${nearest.content} (${minutesLeft}分钟后)`
}

// ===== IPC 通信处理 =====

// ===== 自定义标题栏：窗口控制 =====
ipcMain.on('window-minimize', () => {
  if (mainWindow) mainWindow.minimize()
})

ipcMain.on('window-close', () => {
  // 复用下面的 close 事件处理（依 closeToTray 决定隐藏到托盘还是真正关闭）
  if (mainWindow) mainWindow.close()
})

// 获取设置
ipcMain.handle('get-settings', () => {
  return store.get('settings', {
    reminders: [],
    pet: {
      mood: 'normal',
      happiness: 50,
      displayMode: 'always',
      position: { x: 50, y: 0 },
      skins: { left: 'default', right: 'default' },
      petScale: 0.3
    },
    globalPaused: false,
    autoLaunch: false,
    closeToTray: true,
    workingHours: {
      enabled: false,
      start: '09:00',
      end: '18:00',
      weekdays: [1, 2, 3, 4, 5]
    },
    idleThreshold: 300,
    reminderDefaults: {
      autoClose: true,
      autoCloseDelay: 30,
      postponeMinutes: 5
    }
  })
})

// 保存设置（深度合并）
ipcMain.handle('save-settings', (_event, newSettings) => {
  const currentSettings = store.get('settings', {})
  const mergedSettings = deepMerge(currentSettings, newSettings)
  store.set('settings', mergedSettings)

  // 更新托盘菜单（可能影响提醒状态）
  if (tray) updateTrayMenu()

  return true
})

// 深度合并工具
function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === 'object' &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === 'object' &&
      !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

// 设置开机自启
ipcMain.handle('set-auto-launch', (_event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: true,
    // Windows 上注入 --hidden，启动时据此静默隐藏主窗口
    args: ['--hidden']
  })
  return true
})

// ===== 主窗口 -> 宠物窗口 =====

ipcMain.on('trigger-reminder', (_event, data) => {
  if (petWindow) {
    petWindow.webContents.send('pet-message', {
      type: 'trigger-reminder',
      content: data.content,
      reminderId: data.reminderId,
      autoClose: data.autoClose,
      autoCloseDelay: data.autoCloseDelay,
      position: data.position
    })
  }
})

ipcMain.on('set-pet-display-mode', (_event, mode) => {
  if (petWindow) {
    petWindow.webContents.send('pet-message', {
      type: 'set-display-mode',
      mode: mode
    })
  }
})

ipcMain.on('set-pet-skin', (_event, data) => {
  if (petWindow) {
    petWindow.webContents.send('pet-message', {
      type: 'set-skin',
      position: data.position,
      file: data.file
    })
  }
})

ipcMain.on('set-pet-scale', (_event, scale) => {
  if (petWindow) {
    petWindow.webContents.send('pet-message', {
      type: 'set-scale',
      scale: scale
    })
  }
})

ipcMain.on('sync-pet-state', (_event, data) => {
  if (petWindow) {
    petWindow.webContents.send('pet-message', {
      type: 'sync-pet-state',
      happiness: data.happiness,
      mood: data.mood
    })
  }
})

ipcMain.on('preview-reminder', (_event, data) => {
  if (petWindow) {
    petWindow.webContents.send('pet-message', {
      type: 'preview-reminder',
      position: data.position
    })
  }
})

// ===== 宠物窗口 -> 主窗口（用户响应）=====

ipcMain.on('reminder-acknowledged', (_event, reminderId) => {
  if (mainWindow) {
    mainWindow.webContents.send('reminder-response', {
      type: 'acknowledged',
      reminderId
    })
  }
})

ipcMain.on('reminder-postponed', (_event, data) => {
  if (mainWindow) {
    mainWindow.webContents.send('reminder-response', {
      type: 'postponed',
      reminderId: data.reminderId,
      delay: data.delay
    })
  }
})

ipcMain.on('reminder-ignored', (_event, reminderId) => {
  if (mainWindow) {
    mainWindow.webContents.send('reminder-response', {
      type: 'ignored',
      reminderId
    })
  }
})

// ===== 空闲检测 =====

ipcMain.handle('get-idle-time', () => {
  return powerMonitor.getSystemIdleTime()
})

// 定期检查空闲状态并推送
let lastIdleState = false

function startIdleMonitor() {
  setInterval(() => {
    const settings = store.get('settings', {})
    const threshold = settings.idleThreshold || 300
    const idleSeconds = powerMonitor.getSystemIdleTime()
    const isIdle = idleSeconds > threshold

    if (isIdle !== lastIdleState) {
      lastIdleState = isIdle
      if (mainWindow) {
        mainWindow.webContents.send('idle-state-changed', isIdle)
      }
    }
  }, 10 * 1000)

  // 用户恢复活动时立即通知
  powerMonitor.on('user-did-become-active', () => {
    lastIdleState = false
    if (mainWindow) {
      mainWindow.webContents.send('idle-state-changed', false)
    }
  })
}

// ===== 应用生命周期 =====

app.whenReady().then(() => {
  createMainWindow()
  createPetWindow()
  createTray()
  startIdleMonitor()

  // 设置开机自启
  const settings = store.get('settings', {})
  if (settings.autoLaunch) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true,
      args: ['--hidden']
    })
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})

const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen, powerMonitor, shell } = require('electron')
const path = require('path')
const fs = require('fs')
const Store = require('electron-store')

// 初始化本地存储
const store = new Store()

// 诊断日志：dev 打终端；打包后没有终端、console.log 会丢，所以同时追加写到
// userData 下的 pet-window-debug.log，开机自启 / 休眠唤醒后也能事后查看
function debugLog(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  console.log(line)
  try {
    fs.appendFileSync(path.join(app.getPath('userData'), 'pet-window-debug.log'), line + '\n')
  } catch (e) { /* 写盘失败忽略，不影响主流程 */ }
}

// 应用图标路径：dev 用 public/，打包后用 dist/（vite 构建时已把 public 复制到 dist）
const isDev = process.env.NODE_ENV === 'development'
const iconPath = path.join(__dirname, isDev ? '../public/icon.png' : '../dist/icon.png')

// 开机自启时由 setLoginItemSettings 的 args 注入 --hidden，据此静默启动（不弹出主窗口）
const startHidden = process.argv.includes('--hidden')

// 单实例锁：防止应用被重复打开（否则两层宠物叠在一起、每条提醒响两遍、两套存储互相覆盖）。
// 抢不到锁说明已有实例在运行，立即退出；唤起主窗口的事交给已有实例（见下面 second-instance）
if (!app.requestSingleInstanceLock()) {
  app.exit(0)
}

// 已在运行时又被启动了一次（比如托盘里挂着，用户又去双击了图标）：把主窗口唤到前台
app.on('second-instance', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
  }
})

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
      nodeIntegration: false,
      // 提醒调度器与好感度衰减跑在本窗口的渲染进程里；窗口收进托盘后
      // Chromium 会把隐藏页面的定时器节流到约每分钟一次，导致提醒迟到、
      // 预告丢失、心情衰减变慢，这里必须关掉节流
      backgroundThrottling: false
    }
  })

  // 隐藏默认菜单栏
  mainWindow.setMenuBarVisibility(false)

  // 静默自启时主窗口虽不 show，但 Windows 偶发会给它留一个点了没反应的任务栏
  // 幽灵图标；隐藏期先 skipTaskbar，真正显示时再恢复正常任务栏行为
  if (startHidden) mainWindow.setSkipTaskbar(true)
  mainWindow.on('show', () => mainWindow.setSkipTaskbar(false))

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 关闭时最小化到托盘；关掉了"关闭到托盘"则整个退出——
  // 提醒调度器跑在主窗口渲染进程里，若只关主窗口留着宠物窗口，
  // 宠物会变成"看着还在、永远不再提醒"的半死状态
  mainWindow.on('close', (event) => {
    if (isQuitting) return
    const settings = store.get('settings', {})
    if (settings.closeToTray !== false) {
      event.preventDefault()
      mainWindow.hide()
    } else {
      isQuitting = true
      app.quit()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  mainWindow.on('ready-to-show', () => {
    // 开机自启（--hidden）时不显示主窗口，隐藏到托盘；由托盘点击唤出
    if (!startHidden) {
      mainWindow.show()
    }
  })
}

// 按主显示器工作区把宠物窗口铺满。开机自启时显卡驱动/DPI/多显示器往往还没就绪，
// 此时拿到的 workArea 是临时的小值——屏幕稳定后会触发 display-metrics-changed，
// 由本函数把窗口重新铺满到正确尺寸（否则宠物会挤在屏幕左上角的小区域里、显得变小）
function refitPetWindow() {
  if (!petWindow || petWindow.isDestroyed()) return
  const display = screen.getPrimaryDisplay()
  const { x, y, width, height } = display.workArea
  const old = petWindow.getBounds()
  // 仅在 bounds 真的与工作区不一致时记录（真正失配的时刻），避免每次冒气泡都刷日志
  if (old.x !== x || old.y !== y || old.width !== width || old.height !== height) {
    debugLog(`[PetWindow] bounds 失配，纠正 old=${JSON.stringify(old)} new=${JSON.stringify({ x, y, width, height })} scaleFactor=${display.scaleFactor}`)
  }
  petWindow.setBounds({ x, y, width, height })
  // Windows 在 DPI 变化/启动早期偶发弄丢 skipTaskbar，任务栏会多出一个点了没反应的
  // 幽灵图标（focusable:false 的本窗口点击无响应）。这里幂等重申，借每次 refit 自愈
  petWindow.setSkipTaskbar(true)
}

// ===== 显示器指纹与开机自启 DPI 看门狗 =====
// 根因（2026-08-04 日志实锤）：开机自启时 Electron 的 screen 模块可能整体停留在
// 桌面就绪前的错误读数（如 1920×1080@1，实际 1707×912@1.5），且 display-metrics-changed
// 一直不补发——refitPetWindow 读到的 workArea 本身就是错的，所有自愈路径全部空转。
// 对策：把「上次正常会话的显示器指纹」持久化；静默自启时若当前读数与指纹不符、
// 又等不来任何 display 事件，判定 screen 读数陈旧，原地重启一次应用（此时桌面已
// 就绪，重启后读数即正确）。--dpi-relaunched 标记保证最多重启一次，防死循环。

const SIG_KEY = 'lastDisplaySignature'

function currentDisplaySignature() {
  const d = screen.getPrimaryDisplay()
  return { ...d.workArea, scaleFactor: d.scaleFactor }
}

// 宽高容忍 ±2px：Windows 150% 缩放下 workArea 宽度会在 1707/1708 间反复抖（见历史日志），不算失配
function signatureMatches(a, b) {
  if (!a || !b) return false
  return a.scaleFactor === b.scaleFactor &&
    a.x === b.x && a.y === b.y &&
    Math.abs(a.width - b.width) <= 2 &&
    Math.abs(a.height - b.height) <= 2
}

// 本次会话收到过的 display 事件数——事件在流动说明 screen 模块是活的、读数可信。
// 用计数而非布尔：唤醒时的看门狗只关心「唤醒之后」有没有新事件，开机时的旧事件不算数
let displayEventCount = 0
// 看门狗单例定时器（开机与唤醒共用，避免并发两轮）
let watchdogTimer = null

// 判定 screen 读数是否陈旧并自愈。trigger 仅用于日志；allowRelaunch 控制超时后
// 能否用静默重启自愈（唤醒时若主窗口正被使用则不重启、只记日志等 display 事件）
function runDisplayWatchdog(trigger, allowRelaunch) {
  const now0 = currentDisplaySignature()
  const stored = store.get(SIG_KEY)
  if (!stored || signatureMatches(stored, now0)) {
    store.set(SIG_KEY, now0)
    return
  }
  if (watchdogTimer) return

  const eventCount0 = displayEventCount
  const relaunched = process.argv.includes('--dpi-relaunched')
  debugLog(`[Watchdog] (${trigger}) 读数与指纹不符 stored=${JSON.stringify(stored)} now=${JSON.stringify(now0)} relaunched=${relaunched} allowRelaunch=${allowRelaunch}`)

  const INTERVAL = 5 * 1000
  const TIMEOUT = 90 * 1000
  let waited = 0
  watchdogTimer = setInterval(() => {
    waited += INTERVAL
    const now = currentDisplaySignature()
    // 期间来过新事件（事件处理里已刷新指纹）或读数自己恢复了：铺回窗口，收工
    if (displayEventCount > eventCount0 || signatureMatches(stored, now)) {
      debugLog(`[Watchdog] (${trigger}) 读数恢复 now=${JSON.stringify(now)} 新事件数=${displayEventCount - eventCount0}`)
      clearInterval(watchdogTimer)
      watchdogTimer = null
      store.set(SIG_KEY, now)
      refitPetWindow()
      return
    }
    if (waited >= TIMEOUT) {
      clearInterval(watchdogTimer)
      watchdogTimer = null
      if (allowRelaunch && !relaunched) {
        debugLog(`[Watchdog] (${trigger}) 超时且无 display 事件，判定 screen 读数陈旧，静默重启自愈`)
        isQuitting = true
        // 重启参数：去掉旧标记、补上 --hidden（唤醒场景下手动启动的会话重启后
        // 不能让主窗口突然弹出来）、带上防循环标记
        const args = process.argv.slice(1).filter(a => a !== '--dpi-relaunched')
        if (!args.includes('--hidden')) args.push('--hidden')
        args.push('--dpi-relaunched')
        app.relaunch({ args })
        app.exit(0)
      } else if (trigger === 'boot' && relaunched) {
        // 重启过一次还对不上：多半是用户真的换了分辨率/显示器，接受当前读数
        debugLog(`[Watchdog] (boot) 重启后读数仍不符，接受当前读数 now=${JSON.stringify(now)}`)
        store.set(SIG_KEY, now)
        refitPetWindow()
      } else {
        // 不便重启（主窗口使用中等）：保留好指纹，指望后续 display 事件 / 冒气泡 refit 修复
        debugLog(`[Watchdog] (${trigger}) 超时放弃本轮，保留指纹等待 display 事件`)
      }
      return
    }
    // screen 若无事件地悄悄修正了读数，这里也能把窗口铺回去
    refitPetWindow()
  }, INTERVAL)
}

// 开机检查：手动启动时桌面必然已就绪、读数可信，直接刷指纹；静默自启才需要看门狗
function startDisplayWatchdog() {
  if (!startHidden) {
    store.set(SIG_KEY, currentDisplaySignature())
    return
  }
  runDisplayWatchdog('boot', true)
}

// 创建宠物窗口（透明，始终置顶）
function createPetWindow() {
  const workArea = screen.getPrimaryDisplay().workArea
  debugLog(`[PetWindow] init ${JSON.stringify({ ...workArea, scaleFactor: screen.getPrimaryDisplay().scaleFactor })}`)

  petWindow = new BrowserWindow({
    width: workArea.width,
    height: workArea.height,
    x: workArea.x,
    y: workArea.y,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    // 先不显示，等 ready-to-show 时"先 skip 再 show"——这是让透明窗口可靠跳过
    // 任务栏的关键顺序（见下方三道防线）
    show: false,
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

  // 透明（layered）窗口在 Windows 上，构造选项里的 skipTaskbar 不可靠——开机自启时
  // explorer/DPI 尚未就绪的竞态下，窗口会钻进任务栏形成"点了没反应的幽灵图标"
  //（focusable:false 导致点它没反应）。单靠 refitPetWindow 的重申不够：refit 只在
  // 冒气泡/显示器事件时才跑，开机后到首次冒气泡之间没有重申机会。这里用三道防线：
  // 1) 创建后立即显式 setSkipTaskbar（不依赖构造选项）；
  // 2) ready-to-show 里"先 skip 再 show"——让透明窗口可靠跳过任务栏的关键顺序；
  // 3) show 后 1.5s 再兜底重申一次，覆盖开机早期 explorer/DPI 抖动。
  // 注意：BrowserWindow 没有 isSkipTaskbar() getter，调用会抛 TypeError 中断后续
  // createTray（导致托盘图标消失），这里只记录动作与可见性（isVisible 是合法 API）
  petWindow.setSkipTaskbar(true)
  debugLog(`[PetWindow] 创建后 setSkipTaskbar(true)`)

  petWindow.once('ready-to-show', () => {
    petWindow.setSkipTaskbar(true)
    petWindow.show()
    debugLog(`[PetWindow] ready-to-show 已 show，isVisible=${petWindow.isVisible()}`)
    setTimeout(() => {
      if (petWindow && !petWindow.isDestroyed()) {
        petWindow.setSkipTaskbar(true)
        debugLog(`[PetWindow] 兜底重申 setSkipTaskbar(true)，isVisible=${petWindow.isVisible()}`)
      }
    }, 1500)
  })

  // 屏幕分辨率/DPI/显示器插拔变化时，把窗口重新铺满到正确工作区（见 refitPetWindow），
  // 同时刷新显示器指纹、标记 screen 模块可信（给开机自启看门狗判断用）。
  // 覆盖：开机自启屏幕迟就绪、运行中改分辨率/缩放、插拔显示器
  const onDisplayChanged = () => {
    displayEventCount++
    store.set(SIG_KEY, currentDisplaySignature())
    refitPetWindow()
  }
  screen.on('display-metrics-changed', onDisplayChanged)
  screen.on('display-added', onDisplayChanged)
  screen.on('display-removed', onDisplayChanged)

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
      positions: { left: null, right: null },
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

// 冒气泡前把宠物窗口拉回最前。两件事一起做：
// 1) refitPetWindow 把窗口重新铺满到当前 workArea——休眠唤醒/锁屏/拔显示器等会让
//    窗口 bounds 与屏幕失配（典型表现：宠物只剩半只、或整只跑到屏幕外、必须退出重启
//    才恢复），而 focusable:false 的窗口无法自愈，这里顺带校准，下次提醒即恢复
// 2) 重新置顶：Windows 的置顶不是一劳永逸，别的置顶窗口弹出/全屏/锁屏/唤醒都可能压下去
function bringPetToFront() {
  if (petWindow && !petWindow.isDestroyed()) {
    refitPetWindow()
    petWindow.setAlwaysOnTop(true, 'screen-saver')
    petWindow.moveTop()
  }
}

ipcMain.on('trigger-reminder', (_event, data) => {
  if (petWindow) {
    bringPetToFront()
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
    bringPetToFront()
    petWindow.webContents.send('pet-message', {
      type: 'preview-reminder',
      position: data.position
    })
  }
})

// 时段问候（工作时段起/止）：转发到宠物窗口，展示为纯消息气泡
ipcMain.on('trigger-greeting', (_event, data) => {
  if (petWindow) {
    bringPetToFront()
    petWindow.webContents.send('pet-message', {
      type: 'greeting',
      content: data.content,
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
      reminderId: data.reminderId
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

  // 系统唤醒 / 解锁后，宠物窗口的 bounds 与层级常会失配（典型表现：宠物只剩半只、或
  // 整只消失）。bringPetToFront 校准 bounds + 重新置顶；此外唤醒后 screen 模块的读数
  // 也可能整体陈旧（同开机自启，refit 拿错值空转），所以再跑一轮看门狗——主窗口正被
  // 使用时不重启（免得打断用户），只等 display 事件；否则超时后静默重启自愈
  const onWakeUp = () => {
    bringPetToFront()
    const mainInUse = mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()
    runDisplayWatchdog('wake', !mainInUse)
  }
  powerMonitor.on('resume', onWakeUp)
  powerMonitor.on('unlock-screen', onWakeUp)
}

// ===== 应用生命周期 =====

app.whenReady().then(() => {
  debugLog(`[App] 启动；日志文件位于 ${path.join(app.getPath('userData'), 'pet-window-debug.log')}`)
  createMainWindow()
  createPetWindow()
  createTray()
  startIdleMonitor()
  startDisplayWatchdog()

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

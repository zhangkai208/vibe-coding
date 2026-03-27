const { app, BrowserWindow, ipcMain, Tray, Menu, nativeImage, screen } = require('electron')
const path = require('path')
const Store = require('electron-store')

// 初始化本地存储
const store = new Store()

// 主窗口
let mainWindow = null
// 宠物窗口
let petWindow = null
// 托盘图标
let tray = null

// 创建主窗口
function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 400,
    height: 600,
    resizable: false,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 开发环境加载 dev server，生产环境加载打包后的文件
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173')
    // mainWindow.webContents.openDevTools() // 注释掉开发者工具
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  // 关闭时最小化到托盘
  mainWindow.on('close', (event) => {
    const settings = store.get('settings', {})
    if (settings.closeToTray !== false) {
      event.preventDefault()
      mainWindow.hide()
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
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
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  // 开发环境加载 dev server，生产环境加载打包后的文件
  if (process.env.NODE_ENV === 'development') {
    petWindow.loadURL('http://localhost:5173/pet.html')
  } else {
    petWindow.loadFile(path.join(__dirname, '../dist/pet.html'))
  }

  // 让透明区域点击穿透，只有宠物可交互
  petWindow.setIgnoreMouseEvents(true, { forward: true })

  // 窗口关闭时清理
  petWindow.on('closed', () => {
    petWindow = null
  })
}

// 创建托盘图标
function createTray() {
  // 创建一个简单的托盘图标（16x16 像素）
  const icon = nativeImage.createEmpty()
  tray = new Tray(icon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示主窗口',
      click: () => {
        mainWindow.show()
      }
    },
    {
      label: '退出',
      click: () => {
        mainWindow = null
        petWindow = null
        app.quit()
      }
    }
  ])

  tray.setToolTip('提醒小助手')
  tray.setContextMenu(contextMenu)

  // 点击托盘图标显示主窗口
  tray.on('click', () => {
    mainWindow.show()
  })
}

// IPC 通信处理
// 获取设置
ipcMain.handle('get-settings', () => {
  return store.get('settings', {
    reminders: [],
    pet: {
      mood: 'normal',
      happiness: 50,
      displayMode: 'always',
      position: { x: 50, y: 0 }
    },
    globalPaused: false,
    autoLaunch: false,
    closeToTray: true
  })
})

// 保存设置
ipcMain.handle('save-settings', (event, settings) => {
  store.set('settings', settings)
  return true
})

// 设置开机自启
ipcMain.handle('set-auto-launch', (event, enable) => {
  app.setLoginItemSettings({
    openAtLogin: enable,
    openAsHidden: true
  })
  return true
})

// 触发提醒（主窗口 -> 宠物窗口）
ipcMain.on('trigger-reminder', (event, data) => {
  if (petWindow) {
    petWindow.webContents.send('pet-message', {
      type: 'trigger-reminder',
      content: data.content,
      position: data.position
    })
  }
})

// 设置宠物显示模式（主窗口 -> 宠物窗口）
ipcMain.on('set-pet-display-mode', (event, mode) => {
  if (petWindow) {
    petWindow.webContents.send('pet-message', {
      type: 'set-display-mode',
      mode: mode
    })
  }
})

// 同步宠物状态（主窗口 -> 宠物窗口）
ipcMain.on('sync-pet-state', (event, data) => {
  if (petWindow) {
    petWindow.webContents.send('pet-message', {
      type: 'sync-pet-state',
      happiness: data.happiness,
      mood: data.mood
    })
  }
})

// 应用就绪
app.whenReady().then(() => {
  createMainWindow()
  createPetWindow()
  createTray()

  // 设置开机自启
  const settings = store.get('settings', {})
  if (settings.autoLaunch) {
    app.setLoginItemSettings({
      openAtLogin: true,
      openAsHidden: true
    })
  }
})

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// macOS 激活应用时重新创建窗口
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createMainWindow()
  }
})

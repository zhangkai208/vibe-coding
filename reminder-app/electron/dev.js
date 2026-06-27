// Electron 开发模式启动包装器
//
// 为什么需要它：
// VSCode（以及任何 Electron 宿主）会向其派生的终端/子进程注入 ELECTRON_RUN_AS_NODE=1，
// 让自己以「纯 Node」模式运行。子进程会继承这个变量，导致 `electron .` 启动后
// 主进程拿不到 app / BrowserWindow（app 为 undefined），应用窗口根本起不来，
// preload / IPC / electron-store 全部失效——表现就是「界面看着在，但什么都存不进去」。
//
// 注意：把变量设成空字符串没用，electron 只要检测到该变量「存在」就当作 Node 模式。
// 必须在 spawn electron 之前真正 delete 掉它，所以用这个 node 脚本来启动 electron。
const { spawn } = require('child_process')
const electronPath = require('electron') // 在 node 环境下返回 electron 可执行文件路径

delete process.env.ELECTRON_RUN_AS_NODE

const target = process.argv[2] || '.'
const child = spawn(electronPath, [target], {
  stdio: 'inherit',
  env: { ...process.env }
})

child.on('close', (code) => {
  process.exit(code ?? 0)
})

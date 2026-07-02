// 判断当前是否在工作时段内
export function isWithinWorkingHours(workingHours) {
  if (!workingHours || !workingHours.enabled) return true

  const now = new Date()
  const day = now.getDay() // 0=周日, 1=周一, ...
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  // 星期几检查（workingHours.weekdays 存的是 [1,2,3,4,5] 表示周一到周五）
  const weekday = day === 0 ? 7 : day
  if (!workingHours.weekdays || !workingHours.weekdays.includes(weekday)) {
    return false
  }

  // 时间段检查
  const startParts = (workingHours.start || '09:00').split(':').map(Number)
  const endParts = (workingHours.end || '18:00').split(':').map(Number)
  const startMinutes = startParts[0] * 60 + startParts[1]
  const endMinutes = endParts[0] * 60 + endParts[1]

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes
}

// 当前时刻是否恰好落在工作时段的起点/终点那一分钟（且当天是选定工作日）。
// 命中返回 'start' | 'end'，否则 null。调度器 10 秒一跳，同一分钟会命中多次，
// "每天只发一次"的去重由调用方负责
export function matchWorkBoundary(workingHours) {
  if (!workingHours || !workingHours.enabled) return null

  const now = new Date()
  const day = now.getDay()
  const weekday = day === 0 ? 7 : day
  if (!workingHours.weekdays || !workingHours.weekdays.includes(weekday)) return null

  const toMinutes = (str, fallback) => {
    const [h, m] = (str || fallback).split(':').map(Number)
    return h * 60 + m
  }
  const currentMinutes = now.getHours() * 60 + now.getMinutes()

  if (currentMinutes === toMinutes(workingHours.start, '09:00')) return 'start'
  if (currentMinutes === toMinutes(workingHours.end, '18:00')) return 'end'
  return null
}

// 格式化分钟为可读文本
export function formatInterval(minutes) {
  if (minutes < 60) {
    return `每 ${minutes} 分钟`
  } else if (minutes === 60) {
    return '每 1 小时'
  } else if (minutes % 60 === 0) {
    return `每 ${minutes / 60} 小时`
  } else {
    return `每 ${Math.floor(minutes / 60)} 小时 ${minutes % 60} 分钟`
  }
}

// 格式化倒计时毫秒数为"X小时X分X秒"（用于下次提醒的实时倒计时）
export function formatCountdown(ms) {
  const total = Math.max(0, Math.ceil(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  if (h > 0) return `${h}小时${m}分${s}秒`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

// 格式化时间为 HH:MM
export function formatTime(date) {
  const h = date.getHours().toString().padStart(2, '0')
  const m = date.getMinutes().toString().padStart(2, '0')
  return `${h}:${m}`
}

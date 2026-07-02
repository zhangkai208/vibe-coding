// Live2D 心情参数叠加层（Cubism 2 专用）
//
// 原理：.mtn 动作文件本质是"参数随时间变化的曲线表"，引擎每帧照着它写参数。
// pixi-live2d-display 每帧的更新顺序是：
//   动作写参数 → saveParam → 眨眼/视线/呼吸/物理（临时叠加）
//   → 触发 "beforeModelUpdate" → 计算顶点 → loadParam 还原基准
// 本模块挂在 beforeModelUpdate 上，用与眨眼/呼吸完全相同的方式把"心情偏移"
// 叠加到同一批参数上：
//   - 角度/脸红/眼型用 addToParamFloat 叠加，不破坏动作自身的曲线；
//   - 眼睛开合用乘法（getParamFloat × 系数），半闭眼状态下依然保留眨眼；
//   - loadParam 机制保证叠加每帧重算，绝不累积漂移。
// 心情切换按指数插值平滑过渡（约 0.3~0.5 秒）。

// 每档心情的参数偏移表（数值是调校起点，观感不对就改这里）
export const MOOD_OVERLAYS = {
  //        眯眼笑      脸红        嘴角        瞪眼变形    眼睛开合×      头横转     头俯仰      身体侧倾
  happy:  { smile: 1, cheek: 1,   mouth: 0.5, deform: 0, eyeOpen: 1,    headX: 0,  headY: 0,   body: 0 },
  normal: { smile: 0, cheek: 0,   mouth: 0,   deform: 0, eyeOpen: 1,    headX: 0,  headY: 0,   body: 0 },
  sad:    { smile: 0, cheek: 0,   mouth: 0,   deform: 0, eyeOpen: 0.55, headX: 0,  headY: -14, body: -4 },
  // 生气：扭头不看你（headX 的正负由 awaySign 决定，朝屏幕外侧）+ 气鼓鼓脸红 + 微瞪
  angry:  { smile: 0, cheek: 0.6, mouth: 0,   deform: 1, eyeOpen: 0.8,  headX: 18, headY: -6,  body: 5 }
}

// 叠加键 → Cubism 参数 id（EYEK_R 是 22/33 模型文件里的原始拼写）
const ADD_PARAMS = {
  smile: ['PARAM_EYE_L', 'PARAM_EYEK_R'],
  cheek: ['PARAM_CHEEK'],
  mouth: ['PARAM_MOUTH_1'],
  deform: ['PARAM_EYEDEFORM'],
  headX: ['PARAM_ANGLE_X'],
  headY: ['PARAM_ANGLE_Y'],
  body: ['PARAM_BODY_ANGLE_Z']
}
const EYE_OPEN_PARAMS = ['PARAM_EYE_L_OPEN', 'PARAM_EYE_R_OPEN']

// 心情过渡速度（1/秒），越大过渡越快
const LERP_SPEED = 5

// 创建叠加控制器并挂到模型上；换装重建模型后需要重新创建。
// awaySign：生气扭头的方向，左侧宠物 -1（朝左）、右侧 +1（朝右）
export function createMoodOverlay(live2dModel, { awaySign = 1 } = {}) {
  const internal = live2dModel.internalModel
  const core = internal.coreModel

  // 参数名 → 索引，一次解析；模型缺某参数则为 -1，应用时跳过
  const addIdx = {}
  for (const [key, ids] of Object.entries(ADD_PARAMS)) {
    addIdx[key] = ids.map(id => core.getParamIndex(id))
  }
  const eyeIdx = EYE_OPEN_PARAMS.map(id => core.getParamIndex(id))

  const current = { ...MOOD_OVERLAYS.normal }
  let target = MOOD_OVERLAYS.normal
  let lastTime = performance.now()

  function setMood(mood, { instant = false } = {}) {
    target = MOOD_OVERLAYS[mood] || MOOD_OVERLAYS.normal
    if (instant) Object.assign(current, target)
  }

  function onBeforeModelUpdate() {
    const now = performance.now()
    const k = 1 - Math.exp(-LERP_SPEED * (now - lastTime) / 1000)
    lastTime = now

    for (const key of Object.keys(current)) {
      current[key] += (target[key] - current[key]) * k
    }

    for (const [key, indices] of Object.entries(addIdx)) {
      let v = current[key]
      if (Math.abs(v) < 0.001) continue
      if (key === 'headX' || key === 'body') v *= awaySign
      for (const idx of indices) {
        if (idx >= 0) core.addToParamFloat(idx, v)
      }
    }

    const mult = current.eyeOpen
    if (Math.abs(mult - 1) > 0.001) {
      for (const idx of eyeIdx) {
        if (idx >= 0) core.setParamFloat(idx, core.getParamFloat(idx) * mult)
      }
    }
  }

  internal.on('beforeModelUpdate', onBeforeModelUpdate)

  return {
    setMood,
    destroy() {
      internal.off('beforeModelUpdate', onBeforeModelUpdate)
    }
  }
}

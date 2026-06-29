// 服装清单（22 / 33 通用，文件名结构完全一致）
// id   - 存储与选择用的标识
// file - 对应的 model.*.json 文件名（与 public/models/{22,33}/ 下的文件一致）
// name - 设置页下拉显示名（中文暂定名，可按需调整）
export const SKINS = [
  { id: 'default', file: 'model.default.json', name: '默认' },
  { id: '2016.xmas.1', file: 'model.2016.xmas.1.json', name: '圣诞装 ①' },
  { id: '2016.xmas.2', file: 'model.2016.xmas.2.json', name: '圣诞装 ②' },
  { id: '2017.newyear', file: 'model.2017.newyear.json', name: '新年装' },
  { id: '2017.school', file: 'model.2017.school.json', name: '校服' },
  { id: '2017.valley', file: 'model.2017.valley.json', name: '户外装' },
  { id: '2017.vdays', file: 'model.2017.vdays.json', name: '情人节装' },
  { id: '2017.cba-normal', file: 'model.2017.cba-normal.json', name: '运动装·常服' },
  { id: '2017.cba-super', file: 'model.2017.cba-super.json', name: '运动装·盛装' },
  { id: '2017.summer.normal.1', file: 'model.2017.summer.normal.1.json', name: '夏季常服 ①' },
  { id: '2017.summer.normal.2', file: 'model.2017.summer.normal.2.json', name: '夏季常服 ②' },
  { id: '2017.summer.super.1', file: 'model.2017.summer.super.1.json', name: '夏季盛装 ①' },
  { id: '2017.summer.super.2', file: 'model.2017.summer.super.2.json', name: '夏季盛装 ②' },
  { id: '2017.tomo-bukatsu.high', file: 'model.2017.tomo-bukatsu.high.json', name: '社团装·华丽' },
  { id: '2017.tomo-bukatsu.low', file: 'model.2017.tomo-bukatsu.low.json', name: '社团装·朴素' },
  { id: '2018.spring', file: 'model.2018.spring.json', name: '春装' },
  { id: '2018.lover', file: 'model.2018.lover.json', name: '情人装' },
  { id: '2018.bls-summer', file: 'model.2018.bls-summer.json', name: '夏装(碧蓝)' },
  { id: '2018.bls-winter', file: 'model.2018.bls-winter.json', name: '冬装(碧蓝)' }
]

// 皮肤 id -> model.*.json 文件名；查不到时回退默认
export function skinToFile(id) {
  return SKINS.find(s => s.id === id)?.file || 'model.default.json'
}

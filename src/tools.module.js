const { useCache, hashCode } = importModule('utils.module')
const cache = useCache()
const ScriptName = Script.name()

const named = SFSymbol.named
SFSymbol.named = (str) => {
  const current = named(str)
  if (!current.image) {
    return named('photo')
  }
  return current
}
// 获取 Request 对象
const getRequest = (url = '') => {
  return new Request(url)
}

// 发起请求
const http = async (
  options = { headers: {}, url: '' },
  type = 'JSON',
  onError = () => {
    return SFSymbol.named('photo').image
  }
) => {
  let request
  try {
    if (type === 'IMG') {
      const fm = FileManager.local()
      const fileName = `${hashCode(options.url)}`
      const filePath = fm.joinPath(cache.cacheDirectory, fileName)
      request = getRequest(options.url)
      let response
      if (await fm.readString(filePath)) {
        request.loadImage().then((res) => {
          cache.writeImage(filePath, res)
        })
        return Image.fromFile(filePath)
      } else {
        response = await request.loadImage()
        cache.writeImage(filePath, response)
      }
      return response
    }
    request = getRequest()
    Object.keys(options).forEach((key) => {
      request[key] = options[key]
    })
    request.headers = { ...options.headers }

    if (type === 'JSON') {
      return await request.loadJSON()
    }
    if (type === 'STRING') {
      return await request.loadString()
    }
    return await request.loadJSON()
  } catch (e) {
    console.error('error:\n' + e + '\n' + type)
    if (type === 'IMG') return onError?.()
  }
}

// request 接口请求
const httpRequest = {
  get: (url = '', options = {}, type = 'JSON') => {
    let params = { ...options, method: 'GET' }
    if (typeof url === 'object') {
      params = { ...params, ...url }
    } else {
      params.url = url
    }
    let _type = type
    if (typeof options === 'string') _type = options
    return http(params, _type)
  },
  post: (url = '', options = {}, type = 'JSON') => {
    let params = { ...options, method: 'POST' }
    if (typeof url === 'object') {
      params = { ...params, ...url }
    } else {
      params.url = url
    }
    let _type = type
    if (typeof options === 'string') _type = options
    return http(params, _type)
  }
}

// 获取 boxJS 数据
const getBoxJsData = async (options = {}) => {
  const params = Object.assign({
    boxJsSite: 'boxjs.com',
    key: ''
  }, options)
  const key = params.key
  try {
    let url = 'http://' + params.boxJsSite + '/query/boxdata'
    if (key) url = 'http://' + params.boxJsSite + '/query/data/' + key
    const boxdata = await httpRequest.get(
      url,
      key ? { timeoutInterval: 1 } : {}
    )

    if (boxdata.val) return boxdata.val

    return boxdata.datas
  } catch (e) {
    console.error(
      `${ScriptName} - BoxJS 数据读取失败\n,
      请检查 BoxJS 域名是否为代理复写的域名，如（boxjs.net 或 boxjs.com）。\n若没有配置 BoxJS 相关模块，请点击通知查看教程：\n
      https://chavyleung.gitbook.io/boxjs/awesome/videos`
    )
    return ''
  }
}

const getRefreshTime = (refreshAfterDate) => {
  refreshAfterDate = refreshAfterDate || 30
  if (refreshAfterDate <= 0) refreshAfterDate = 30
  const refreshTime = parseInt(refreshAfterDate) * 1000 * 60
  const timeStr = new Date().getTime() + refreshTime
  return new Date(timeStr)
}

/**
 * 渲染标题内容
 * @param {object} widget 组件对象
 * @param {string} icon 图标地址
 * @param {string} title 标题内容
 * @param {bool|color} color 字体的颜色（自定义背景时使用，默认系统）
 */
const renderHeader = async (widget, icon, title, color = false) => {
  const header = widget.addStack()
  header.centerAlignContent()
  try {
    const image = await httpRequest.get(icon, 'IMG')
    const _icon = header.addImage(image)
    _icon.imageSize = new Size(14, 14)
    _icon.cornerRadius = 4
  } catch (e) {
    console.error(`renderHeader：${JSON.stringify(e)}`)
  }
  header.addSpacer(10)
  const _title = header.addText(title)
  if (color) _title.textColor = color
  _title.textOpacity = 0.7
  _title.font = Font.boldSystemFont(12)
  _title.lineLimit = 1
  widget.addSpacer(15)
  return widget
}

const renderNone = async (widget, message = '暂无数据') => {
  widget.addSpacer()
  const noneView = widget.addStack()
  noneView.addSpacer()
  const noneText = noneView.addText(message)
  noneText.font = new Font('SF Mono', 12)
  noneText.textColor = new Color('#333333')
  noneView.addSpacer()

  return widget
}

module.exports = {
  httpRequest,
  getBoxJsData,
  getRefreshTime,
  renderHeader,
  renderNone
}

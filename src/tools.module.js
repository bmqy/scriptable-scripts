const { useCache } = importModule('utils.module')
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

/**
 * base64 编码字符串
 * @param {string} str 要编码的字符串
 */
const base64Encode = (str) => {
  const data = Data.fromString(str)
  return data.toBase64String()
}
/**
 * base64解码数据 返回字符串
 * @param {string} b64 base64编码的数据
 */
const base64Decode = (b64) => {
  const data = Data.fromBase64String(b64)
  return data.toRawString()
}
/**
 * md5 加密字符串
 * @param {string} str 要加密成md5的数据
 */
// prettier-ignore
// eslint-disable-next-line
const md5 = (str)=>{function d(n,t){var r=(65535&n)+(65535&t);return(((n>>16)+(t>>16)+(r>>16))<<16)|(65535&r)}function f(n,t,r,e,o,u){return d(((c=d(d(t,n),d(e,u)))<<(f=o))|(c>>>(32-f)),r);var c,f}function l(n,t,r,e,o,u,c){return f((t&r)|(~t&e),n,t,o,u,c)}function v(n,t,r,e,o,u,c){return f((t&e)|(r&~e),n,t,o,u,c)}function g(n,t,r,e,o,u,c){return f(t^r^e,n,t,o,u,c)}function m(n,t,r,e,o,u,c){return f(r^(t|~e),n,t,o,u,c)}function i(n,t){var r,e,o,u;(n[t>>5]|=128<<t%32),(n[14+(((t+64)>>>9)<<4)]=t);for(var c=1732584193,f=-271733879,i=-1732584194,a=271733878,h=0;h<n.length;h+=16)(c=l((r=c),(e=f),(o=i),(u=a),n[h],7,-680876936)),(a=l(a,c,f,i,n[h+1],12,-389564586)),(i=l(i,a,c,f,n[h+2],17,606105819)),(f=l(f,i,a,c,n[h+3],22,-1044525330)),(c=l(c,f,i,a,n[h+4],7,-176418897)),(a=l(a,c,f,i,n[h+5],12,1200080426)),(i=l(i,a,c,f,n[h+6],17,-1473231341)),(f=l(f,i,a,c,n[h+7],22,-45705983)),(c=l(c,f,i,a,n[h+8],7,1770035416)),(a=l(a,c,f,i,n[h+9],12,-1958414417)),(i=l(i,a,c,f,n[h+10],17,-42063)),(f=l(f,i,a,c,n[h+11],22,-1990404162)),(c=l(c,f,i,a,n[h+12],7,1804603682)),(a=l(a,c,f,i,n[h+13],12,-40341101)),(i=l(i,a,c,f,n[h+14],17,-1502002290)),(c=v(c,(f=l(f,i,a,c,n[h+15],22,1236535329)),i,a,n[h+1],5,-165796510,)),(a=v(a,c,f,i,n[h+6],9,-1069501632)),(i=v(i,a,c,f,n[h+11],14,643717713)),(f=v(f,i,a,c,n[h],20,-373897302)),(c=v(c,f,i,a,n[h+5],5,-701558691)),(a=v(a,c,f,i,n[h+10],9,38016083)),(i=v(i,a,c,f,n[h+15],14,-660478335)),(f=v(f,i,a,c,n[h+4],20,-405537848)),(c=v(c,f,i,a,n[h+9],5,568446438)),(a=v(a,c,f,i,n[h+14],9,-1019803690)),(i=v(i,a,c,f,n[h+3],14,-187363961)),(f=v(f,i,a,c,n[h+8],20,1163531501)),(c=v(c,f,i,a,n[h+13],5,-1444681467)),(a=v(a,c,f,i,n[h+2],9,-51403784)),(i=v(i,a,c,f,n[h+7],14,1735328473)),(c=g(c,(f=v(f,i,a,c,n[h+12],20,-1926607734)),i,a,n[h+5],4,-378558,)),(a=g(a,c,f,i,n[h+8],11,-2022574463)),(i=g(i,a,c,f,n[h+11],16,1839030562)),(f=g(f,i,a,c,n[h+14],23,-35309556)),(c=g(c,f,i,a,n[h+1],4,-1530992060)),(a=g(a,c,f,i,n[h+4],11,1272893353)),(i=g(i,a,c,f,n[h+7],16,-155497632)),(f=g(f,i,a,c,n[h+10],23,-1094730640)),(c=g(c,f,i,a,n[h+13],4,681279174)),(a=g(a,c,f,i,n[h],11,-358537222)),(i=g(i,a,c,f,n[h+3],16,-722521979)),(f=g(f,i,a,c,n[h+6],23,76029189)),(c=g(c,f,i,a,n[h+9],4,-640364487)),(a=g(a,c,f,i,n[h+12],11,-421815835)),(i=g(i,a,c,f,n[h+15],16,530742520)),(c=m(c,(f=g(f,i,a,c,n[h+2],23,-995338651)),i,a,n[h],6,-198630844,)),(a=m(a,c,f,i,n[h+7],10,1126891415)),(i=m(i,a,c,f,n[h+14],15,-1416354905)),(f=m(f,i,a,c,n[h+5],21,-57434055)),(c=m(c,f,i,a,n[h+12],6,1700485571)),(a=m(a,c,f,i,n[h+3],10,-1894986606)),(i=m(i,a,c,f,n[h+10],15,-1051523)),(f=m(f,i,a,c,n[h+1],21,-2054922799)),(c=m(c,f,i,a,n[h+8],6,1873313359)),(a=m(a,c,f,i,n[h+15],10,-30611744)),(i=m(i,a,c,f,n[h+6],15,-1560198380)),(f=m(f,i,a,c,n[h+13],21,1309151649)),(c=m(c,f,i,a,n[h+4],6,-145523070)),(a=m(a,c,f,i,n[h+11],10,-1120210379)),(i=m(i,a,c,f,n[h+2],15,718787259)),(f=m(f,i,a,c,n[h+9],21,-343485551)),(c=d(c,r)),(f=d(f,e)),(i=d(i,o)),(a=d(a,u));return[c,f,i,a]}function a(n){for(var t='',r=32*n.length,e=0;e<r;e+=8)t+=String.fromCharCode((n[e>>5]>>>e%32)&255);return t}function h(n){var t=[];for(t[(n.length>>2)-1]=void 0,e=0;e<t.length;e+=1)t[e]=0;for(var r=8*n.length,e=0;e<r;e+=8)t[e>>5]|=(255&n.charCodeAt(e/8))<<e%32;return t}function e(n){for(var t,r='0123456789abcdef',e='',o=0;o<n.length;o+=1)(t=n.charCodeAt(o)),(e+=r.charAt((t>>>4)&15)+r.charAt(15&t));return e}function r(n){return unescape(encodeURIComponent(n))}function o(n){return a(i(h((t=r(n))),8*t.length));var t}function u(n,t){return(function(n,t){var r,e,o=h(n),u=[],c=[];for(u[15]=c[15]=void 0,16<o.length&&(o=i(o,8*n.length)),r=0;r<16;r+=1)(u[r]=909522486^o[r]),(c[r]=1549556828^o[r]);return((e=i(u.concat(h(t)),512+8*t.length)),a(i(c.concat(e),640)))})(r(n),r(t))}function t(n,t,r){return t?(r?u(t,n):e(u(t,n))):r?o(n):e(o(n))}return t(str)}

const reopenScript = () => {
  Safari.open(`scriptable:///run/${encodeURIComponent(ScriptName)}`)
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
      const fileName = await md5(options.url)
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
  renderNone,
  base64Encode,
  base64Decode,
  md5,
  reopenScript
}

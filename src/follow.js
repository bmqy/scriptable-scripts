if (typeof require === 'undefined') require = importModule
const { withSettings, writeSettings } = require('./withSettings.module')
const { i18n, useCache, timeOffset } = require('./utils.module')
const { httpRequest, getBoxJsData, renderHeader, renderNone, getRefreshTime } = require('./tools.module')

const preference = {
  name: 'Follow',
  logo: 'https://image.bmqy.net/upload/follow.png',
  view: 0,
  refreshAfterDate: 30,
  insertedAfter: new Date().getTime() - 1800000,
  feedId: '',
  showThumb: false,
  minListCount: 3,
  maxListCount: 8,
  minListThumbCount: 2,
  maxListThumbCount: 5,
  colorLight: '#333333',
  backgroundColorLight: '#ffffff',
  colorDark: '#fefefe',
  backgroundColorDark: '#1c1c1c'
}

// 脚本内部变量
let fontColor = new Color(preference.colorLight)
const categoryOptions = [
  {
    label: '文章',
    value: 0
  },
  {
    label: '社交媒体',
    value: 1
  },
  {
    label: '视频',
    value: 2
  },
  {
    label: '音频',
    value: 3
  },
  {
    label: '图片',
    value: 4
  },
  {
    label: '通知',
    value: 5
  }
]
let feedsList = []

const getHeaders = async () => {
  try {
    const csrfToken = await getBoxJsData({ key: 'follow_csrfToken' })
    const cookie = await getBoxJsData({ key: 'follow_cookie' })
    if (!csrfToken || !cookie) {
      throw new Error('请先在boxjs中配置账号信息')
    }
    return {
      cookie: cookie,
      'x-csrf-token': csrfToken,
      'content-type': 'application/json; charset=UTF-8',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'
    }
  } catch (error) {
    console.error(`getHeaders:\n${error.message}`)
  }
}
/**
 * 返回订阅列表标题的数组
 * @returns {Array}
 */
const getFeedsListTitles = async () => {
  feedsList = await getFeedsList()
  if (feedsList.length === 0) return []
  const arr = []
  arr.push({ label: '全部', value: '' })
  for (let i = 0; i < feedsList.length; i++) {
    const item = feedsList[i]
    arr.push({ label: item.feeds.title, value: item.feedId })
  };
  return arr
}
/**
 * 获取订阅列表
 * @returns {Array} 订阅列表
 */
const getFeedsList = async () => {
  try {
    const url = 'https://api.follow.is/subscriptions'
    const res = await httpRequest.get(url, { headers: await getHeaders() })
    // log(res)
    if (res.code === 0) {
      return res.data
    } else {
      console.log(res.message)
      return []
    }
  } catch (error) {
    console.error(`getFeedsList:\n${error.message}`)
    return []
  }
}
/**
 * 检测是否有新的订阅
 * @returns {Boolean}
 */
const checkNew = async () => {
  try {
    const params = {
      view: preference.view,
      read: false,
      insertedAfter: preference.insertedAfter,
      feedId: preference.feedId
    }
    const url = `https://api.follow.is/entries/check-new?view=${params.view}&read=${params.read}&insertedAfter=${params.insertedAfter}&feedId=${params.feedId}`
    const res = await httpRequest.get(url, { headers: await getHeaders() })
    // log(res)
    if (res.code === 0) {
      if (res.data.has_new) {
        preference.insertedAfter = new Date(res.data.lastest_at).getTime()
        writeSettings(preference, { useICloud: preference.useICloud })
      }
      return res.data.has_new
    } else {
      log(res.message)
    }
  } catch (error) {
    console.error(`checkNew:\n${error.message}`)
  }
  return false
}
/**
 * 获取订阅文章列表
 * @returns {Array} 列表
 */
const getList = async () => {
  const cache = useCache()
  const lastDataFileCacheKey = preference.feedId ? `last_data_${preference.feedId}.json` : 'last_data.json'
  let lastData = cache.readJSON(lastDataFileCacheKey) || []
  try {
    const hasNew = await checkNew()
    if (hasNew) {
      const url = 'https://api.follow.is/entries'
      const params = {
        view: preference.view,
        read: false,
        isArchived: false,
        feedId: preference.feedId
      }
      const res = await httpRequest.post(url, { body: JSON.stringify(params), headers: await getHeaders() })
      // log(res)
      if (res.code === 0) {
        const list = []
        if (res.data.length > 0) {
          const resData = res.data
          for (let i = 0; i < Math.min(preference.maxListCount, resData.length); i++) {
            const data = resData[i]
            const item = {
              id: data.entries.id,
              site: data.feeds.title,
              url: data.entries.url,
              title: data.entries.title || data.entries.description,
              media: data.entries.media ? data.entries.media[0].url : '',
              insertedAt: data.entries.insertedAt
            }
            list.push(item)
          }
        }

        lastData = list
        cache.writeJSON(lastDataFileCacheKey, lastData)
        return lastData
      } else {
        log(res.message)
        return lastData
      }
    } else {
      return lastData
    }
  } catch (error) {
    console.error(`getList:\n${error.message}`)
    return lastData
  }
}

// 文字列表
const getListTextStack = (list, listStack) => {
  listStack.spacing = 5
  for (let i = 0; i < list.length; i++) {
    const data = list[i]
    const listItemStack = listStack.addStack()
    listItemStack.spacing = 5
    listItemStack.layoutVertically()
    listItemStack.url = list[i].url
    const itemSite = listItemStack.addText(data.site)
    itemSite.textColor = fontColor
    itemSite.textOpacity = 0.7
    itemSite.font = new Font('SF Mono', 12)
    const itemTitle = listItemStack.addText(data.title)
    itemTitle.textColor = fontColor
    itemTitle.font = new Font('SF Mono', 12)
  }
}

// 缩略图列表
const getListThumbStack = async (list, listStack) => {
  for (let i = 0; i < list.length; i++) {
    const data = list[i]
    const listItemStack = listStack.addStack()
    listItemStack.url = data.url
    listItemStack.layoutHorizontally()
    const leftStack = listItemStack.addStack()
    leftStack.layoutVertically()
    leftStack.addSpacer()
    leftStack.spacing = 5
    leftStack.size = new Size(240, 0)
    const siteText = leftStack.addText(data.site)
    siteText.textColor = fontColor
    siteText.textOpacity = 0.7
    siteText.font = new Font('SF Mono', 12)
    const titleText = leftStack.addText(data.title)
    titleText.textColor = fontColor
    titleText.font = new Font('SF Mono', 12)
    const rightStack = listItemStack.addStack()
    const img = data.media ? await httpRequest.get(data.media, 'IMG') : SFSymbol.named('photo').image
    const thumb = rightStack.addImage(img)
    thumb.imageSize = new Size(40, 40)
    thumb.imageOpacity = data.media ? 1 : 0.5
    rightStack.setPadding(13, 15, 0, 0)
  }
}
/**
 * @param {WidgetStack} container
 */
const getListStack = async (listStack, list) => {
  // 文字列表
  if (preference.showThumb) {
    await getListThumbStack(list, listStack)
  } else {
    getListTextStack(list, listStack)
  }
}
const createWidget = async (data) => {
  const widget = new ListWidget()
  if (config.widgetFamily === 'small') {
    const textStack = widget.addStack()
    textStack.addText('不支持')
    return widget
  }
  const headerStack = widget.addStack()
  headerStack.url = 'https://app.follow.is/'
  await renderHeader(headerStack, preference.logo, preference.name, fontColor)
  headerStack.addSpacer()
  headerStack.spacing = 5

  const timeStack = headerStack.addStack()
  const lastTimerText = timeStack.addText(`${timeOffset(new Date(preference.insertedAfter))}`)
  lastTimerText.textColor = fontColor
  lastTimerText.textOpacity = 0.3
  lastTimerText.font = new Font('SF Mono', 12)

  if (data.length === 0) {
    return renderNone(widget, '暂无新的订阅')
  }

  widget.addSpacer()
  let listCount = preference.showThumb ? preference.minListThumbCount : preference.minListCount
  if (config.widgetFamily === 'large') {
    listCount = preference.showThumb ? preference.maxListThumbCount : preference.maxListCount
  }
  const list = []
  for (let i = 0; i < Math.min(listCount, data.length); i++) {
    list.push(data[i])
  }
  const listStack = widget.addStack()
  listStack.layoutVertically()
  await getListStack(listStack, list)
  widget.addSpacer()
  return widget
}

await withSettings({
  formItems: [
    {
      label: i18n(['Color Setting', '配色']),
      type: 'group',
      items: [
        {
          name: 'colorLight',
          type: 'color',
          label: i18n(['color light', '白天文字色']),
          media: '(prefers-color-scheme: light)',
          default: preference.colorLight
        },
        {
          name: 'colorDark',
          type: 'color',
          label: i18n(['color dark', '夜间文字色']),
          media: '(prefers-color-scheme: dark)',
          default: preference.colorDark
        }
      ]
    },
    {
      name: 'view',
      label: i18n(['Category', '显示分类']),
      type: 'select',
      options: categoryOptions,
      default: preference.view
    },
    {
      name: 'feedId',
      type: 'select',
      label: i18n(['Site', '选择站点']),
      options: await getFeedsListTitles(),
      default: preference.feedId
    },
    {
      name: 'showThumb',
      label: i18n(['Show Thumb', '显示缩略图']),
      type: 'switch',
      default: preference.showThumb
    },
    {
      name: 'refreshAfterDate',
      label: i18n(['Refresh Time', '刷新时长']),
      type: 'input',
      default: preference.refreshAfterDate
    }
  ],
  homePage: 'https://github.com/bmqy/scriptable-scripts',
  render: async ({ settings, family }) => {
    family && (config.widgetFamily = family)
    Object.assign(preference, settings)
    fontColor = Color.dynamic(
      new Color(preference.colorLight),
      new Color(preference.colorDark)
    )
    const res = await getList()
    const widget = await createWidget(res)
    widget.refreshAfterDate = getRefreshTime(preference.refreshAfterDate)
    return widget
  }
})

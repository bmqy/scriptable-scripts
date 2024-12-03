// Variables used by Scriptable.
// These must be at the very top of the file. Do not edit.
// icon-glyph: rss-square; icon-color: red;
/**
 * @version 1.0.0
 * @author bmqy
 */

/**
 * @version 1.2.2
 */


/**
 * 多语言国际化
 * @param {{[language: string]: string} | [en:string, zh:string]} langs
 */
const i18n = (langs) => {
  const language = Device.language();
  if (Array.isArray(langs)) {
    langs = {
      en: langs[0],
      zh: langs[1],
      others: langs[0]
    };
  } else {
    langs.others = langs.others || langs.en;
  }
  return langs[language] || langs.others
};

/**
 * @param {...string} paths
 */
const joinPath = (...paths) => {
  const fm = FileManager.local();
  return paths.reduce((prev, curr) => {
    return fm.joinPath(prev, curr)
  }, '')
};

/**
 * 规范使用 FileManager。每个脚本使用独立文件夹
 *
 * 注意：桌面组件无法写入 cacheDirectory 和 temporaryDirectory
 * @param {object} options
 * @param {boolean} [options.useICloud]
 * @param {string} [options.basePath]
 */
const useFileManager = (options = {}) => {
  const { useICloud, basePath } = options;
  const fm = useICloud ? FileManager.iCloud() : FileManager.local();
  const paths = [fm.documentsDirectory(), Script.name()];
  if (basePath) {
    paths.push(basePath);
  }
  const cacheDirectory = joinPath(...paths);
  /**
   * 删除路径末尾所有的 /
   * @param {string} filePath
   */
  const safePath = (filePath) => {
    return fm.joinPath(cacheDirectory, filePath).replace(/\/+$/, '')
  };
  /**
   * 如果上级文件夹不存在，则先创建文件夹
   * @param {string} filePath
   */
  const preWrite = (filePath) => {
    const i = filePath.lastIndexOf('/');
    const directory = filePath.substring(0, i);
    if (!fm.fileExists(directory)) {
      fm.createDirectory(directory, true);
    }
  };

  const writeString = (filePath, content) => {
    const nextPath = safePath(filePath);
    preWrite(nextPath);
    fm.writeString(nextPath, content);
  };

  /**
   * @param {string} filePath
   * @param {*} jsonData
   */
  const writeJSON = (filePath, jsonData) => writeString(filePath, JSON.stringify(jsonData));
  /**
   * @param {string} filePath
   * @param {Image} image
   */
  const writeImage = (filePath, image) => {
    const nextPath = safePath(filePath);
    preWrite(nextPath);
    return fm.writeImage(nextPath, image)
  };

  /**
   * 文件不存在时返回 null
   * @param {string} filePath
   * @returns {string|null}
   */
  const readString = (filePath) => {
    const fullPath = fm.joinPath(cacheDirectory, filePath);
    if (fm.fileExists(fullPath)) {
      return fm.readString(
        fm.joinPath(cacheDirectory, filePath)
      )
    }
    return null
  };

  /**
   * @param {string} filePath
   */
  const readJSON = (filePath) => JSON.parse(readString(filePath));

  /**
   * @param {string} filePath
   */
  const readImage = (filePath) => {
    const fullPath = safePath(filePath);
    if (fm.fileExists(fullPath)) {
      return fm.readImage(fullPath)
    }
    return null
  };

  return {
    cacheDirectory,
    writeString,
    writeJSON,
    writeImage,
    readString,
    readJSON,
    readImage
  }
};

/** 规范使用文件缓存。每个脚本使用独立文件夹 */
const useCache = () => useFileManager({ basePath: 'cache' });

/**
 * 时差
 * @param {Date} date
 * @returns {string} 如：1小时前
 */
const timeOffset = (date) => {
  const now = new Date();
  let offset = now.getTime() - date.getTime();
  const type = offset < 0 ? i18n([' later', '后']) : i18n([' ago', '前']);
  const minute = i18n(['minutes', '分钟']);
  const hour = i18n(['hours', '小时']);
  const day = i18n(['days', '天']);
  if (offset < 0) {
    offset = Math.abs(offset);
  }
  if (offset < 60000) {
    // 小于一分钟
    return i18n([`${Math.ceil(offset / 1000)} seconds${type}`, '刚刚'])
  }
  if (offset < 3600000) {
    // 小于一小时
    const minutes = Math.ceil(offset / 60000);
    return `${minutes} ${minute}${type}`
  }
  if (offset < 24 * 3600000) {
    // 小于一天
    const hours = Math.ceil(offset / 3600000);
    return `${hours} ${hour}${type}`
  }

  const days = Math.ceil(offset / (24 * 3600000));
  return `${days} ${day}${type}`
};

/**
 * @file Scriptable WebView JSBridge native SDK
 * @version 1.0.3
 * @author Honye
 */

/**
 * @typedef Options
 * @property {Record<string, () => void>} methods
 */

const sendResult = (() => {
  let sending = false;
  /** @type {{ code: string; data: any }[]} */
  const list = [];

  /**
   * @param {WebView} webView
   * @param {string} code
   * @param {any} data
   */
  return async (webView, code, data) => {
    if (sending) return

    sending = true;
    list.push({ code, data });
    const arr = list.splice(0, list.length);
    for (const { code, data } of arr) {
      const eventName = `ScriptableBridge_${code}_Result`;
      const res = data instanceof Error ? { err: data.message } : data;
      await webView.evaluateJavaScript(
        `window.dispatchEvent(
          new CustomEvent(
            '${eventName}',
            { detail: ${JSON.stringify(res)} }
          )
        )`
      );
    }
    if (list.length) {
      const { code, data } = list.shift();
      sendResult(webView, code, data);
    } else {
      sending = false;
    }
  }
})();

/**
 * @param {WebView} webView
 * @param {Options} options
 */
const inject = async (webView, options) => {
  const js =
`(() => {
  const queue = window.__scriptable_bridge_queue
  if (queue && queue.length) {
    completion(queue)
  }
  window.__scriptable_bridge_queue = null

  if (!window.ScriptableBridge) {
    window.ScriptableBridge = {
      invoke(name, data, callback) {
        const detail = { code: name, data }

        const eventName = \`ScriptableBridge_\${name}_Result\`
        const controller = new AbortController()
        window.addEventListener(
          eventName,
          (e) => {
            callback && callback(e.detail)
            controller.abort()
          },
          { signal: controller.signal }
        )

        if (window.__scriptable_bridge_queue) {
          window.__scriptable_bridge_queue.push(detail)
          completion()
        } else {
          completion(detail)
          window.__scriptable_bridge_queue = []
        }
      }
    }
    window.dispatchEvent(
      new CustomEvent('ScriptableBridgeReady')
    )
  }
})()`;

  const res = await webView.evaluateJavaScript(js, true);
  if (!res) return inject(webView, options)

  const methods = options.methods || {};
  const events = Array.isArray(res) ? res : [res];
  // 同时执行多次 webView.evaluateJavaScript Scriptable 存在问题
  // 可能是因为 JavaScript 是单线程导致的
  const sendTasks = events.map(({ code, data }) => {
    return (() => {
      try {
        return Promise.resolve(methods[code](data))
      } catch (e) {
        return Promise.reject(e)
      }
    })()
      .then((res) => sendResult(webView, code, res))
      .catch((e) => {
        console.error(e);
        sendResult(webView, code, e instanceof Error ? e : new Error(e));
      })
  });
  await Promise.all(sendTasks);
  inject(webView, options);
};

/**
 * @param {WebView} webView
 * @param {object} args
 * @param {string} args.html
 * @param {string} [args.baseURL]
 * @param {Options} options
 */
const loadHTML = async (webView, args, options = {}) => {
  const { html, baseURL } = args;
  await webView.loadHTML(html, baseURL);
  inject(webView, options).catch((err) => console.error(err));
};

/**
 * 轻松实现桌面组件可视化配置
 *
 * - 颜色选择器及更多表单控件
 * - 快速预览
 *
 * GitHub: https://github.com/honye
 *
 * @version 1.6.2
 * @author Honye
 */

const fm = FileManager.local();
const fileName = 'settings.json';

const toast = (message) => {
  const notification = new Notification();
  notification.title = Script.name();
  notification.body = message;
  notification.schedule();
};

const isUseICloud = () => {
  const ifm = useFileManager({ useICloud: true });
  const filePath = fm.joinPath(ifm.cacheDirectory, fileName);
  return fm.fileExists(filePath)
};

/**
 * @returns {Promise<Settings>}
 */
const readSettings = async () => {
  const useICloud = isUseICloud();
  console.log(`[info] use ${useICloud ? 'iCloud' : 'local'} settings`);
  const fm = useFileManager({ useICloud });
  const settings = fm.readJSON(fileName);
  return settings
};

/**
 * @param {Record<string, unknown>} data
 * @param {{ useICloud: boolean; }} options
 */
const writeSettings = async (data, { useICloud }) => {
  const fm = useFileManager({ useICloud });
  fm.writeJSON(fileName, data);
};

const removeSettings = async (settings) => {
  const cache = useFileManager({ useICloud: settings.useICloud });
  fm.remove(
    fm.joinPath(cache.cacheDirectory, fileName)
  );
};

const moveSettings = (useICloud, data) => {
  const localFM = useFileManager();
  const iCloudFM = useFileManager({ useICloud: true });
  const [i, l] = [
    fm.joinPath(iCloudFM.cacheDirectory, fileName),
    fm.joinPath(localFM.cacheDirectory, fileName)
  ];
  try {
    // 移动文件需要创建父文件夹，写入操作会自动创建文件夹
    writeSettings(data, { useICloud });
    if (useICloud) {
      if (fm.fileExists(l)) fm.remove(l);
    } else {
      if (fm.fileExists(i)) fm.remove(i);
    }
  } catch (e) {
    console.error(e);
  }
};

/**
 * @typedef {object} NormalFormItem
 * @property {string} name
 * @property {string} label
 * @property {'text'|'number'|'color'|'select'|'date'|'cell'} [type]
 *  - HTML <input> type 属性
 *  - `'cell'`: 可点击的
 * @property {'(prefers-color-scheme: light)'|'(prefers-color-scheme: dark)'} [media]
 * @property {{ label: string; value: unknown }[]} [options]
 * @property {unknown} [default]
 */
/**
 * @typedef {Pick<NormalFormItem, 'label'|'name'> & { type: 'group', items: FormItem[] }} GroupFormItem
 */
/**
 * @typedef {Omit<NormalFormItem, 'type'> & { type: 'page' } & Pick<Options, 'formItems'|'onItemClick'>} PageFormItem 单独的页面
 */
/**
 * @typedef {NormalFormItem|GroupFormItem|PageFormItem} FormItem
 */
/**
 * @typedef {object} CommonSettings
 * @property {boolean} useICloud
 * @property {string} [backgroundImage] 背景图路径
 * @property {string} [backgroundColorLight]
 * @property {string} [backgroundColorDark]
 */
/**
 * @typedef {CommonSettings & Record<string, unknown>} Settings
 */
/**
 * @typedef {object} Options
 * @property {(data: {
 *  settings: Settings;
 *  family?: typeof config.widgetFamily;
 * }) => ListWidget | Promise<ListWidget>} render
 * @property {string} [head] 顶部插入 HTML
 * @property {FormItem[]} [formItems]
 * @property {(item: FormItem) => void} [onItemClick]
 * @property {string} [homePage] 右上角分享菜单地址
 * @property {(data: any) => void} [onWebEvent]
 */
/**
 * @template T
 * @typedef {T extends infer O ? {[K in keyof O]: O[K]} : never} Expand
 */

const previewsHTML =
`<div class="actions">
  <button class="preview" data-size="small"><i class="iconfont icon-yingyongzhongxin"></i>${i18n(['Small', '预览小号'])}</button>
  <button class="preview" data-size="medium"><i class="iconfont icon-daliebiao"></i>${i18n(['Medium', '预览中号'])}</button>
  <button class="preview" data-size="large"><i class="iconfont icon-dantupailie"></i>${i18n(['Large', '预览大号'])}</button>
</div>`;

const copyrightHTML =
`<footer>
  <div class="copyright">© UI powered by <a href="javascript:invoke('safari','https://www.imarkr.com');">iMarkr</a>.</div>
</footer>`;

/**
 * @param {Expand<Options>} options
 * @param {boolean} [isFirstPage]
 * @param {object} [others]
 * @param {Settings} [others.settings]
 * @returns {Promise<ListWidget|undefined>} 仅在 Widget 中运行时返回 ListWidget
 */
const present = async (options, isFirstPage, others = {}) => {
  const {
    formItems = [],
    onItemClick,
    render,
    head,
    homePage = 'https://www.imarkr.com',
    onWebEvent
  } = options;
  const cache = useCache();

  const settings = others.settings || await readSettings() || {};

  /**
   * @param {Parameters<Options['render']>[0]} param
   */
  const getWidget = async (param) => {
    const widget = await render(param);
    const { backgroundImage, backgroundColorLight, backgroundColorDark } = settings;
    if (backgroundImage && fm.fileExists(backgroundImage)) {
      widget.backgroundImage = fm.readImage(backgroundImage);
    }
    if (!widget.backgroundColor || backgroundColorLight || backgroundColorDark) {
      widget.backgroundColor = Color.dynamic(
        new Color(backgroundColorLight || '#ffffff'),
        new Color(backgroundColorDark || '#242426')
      );
    }
    return widget
  };

  if (config.runsInWidget) {
    const widget = await getWidget({ settings });
    Script.setWidget(widget);
    return widget
  }

  // ====== web start =======
  const style =
`:root {
  --color-primary: #007aff;
  --divider-color: rgba(60,60,67,0.36);
  --card-background: #fff;
  --card-radius: 10px;
  --list-header-color: rgba(60,60,67,0.6);
}
* {
  -webkit-user-select: none;
  user-select: none;
}
body {
  margin: 10px 0;
  -webkit-font-smoothing: antialiased;
  font-family: "SF Pro Display","SF Pro Icons","Helvetica Neue","Helvetica","Arial",sans-serif;
  accent-color: var(--color-primary);
}
input {
  -webkit-user-select: auto;
  user-select: auto;
}
body {
  background: #f2f2f7;
}
button {
  font-size: 16px;
  background: var(--color-primary);
  color: #fff;
  border-radius: 8px;
  border: none;
  padding: 0.24em 0.5em;
}
button .iconfont {
  margin-right: 6px;
}
.list {
  margin: 15px;
}
.list__header {
  margin: 0 20px;
  color: var(--list-header-color);
  font-size: 13px;
}
.list__body {
  margin-top: 10px;
  background: var(--card-background);
  border-radius: var(--card-radius);
  border-radius: 12px;
  overflow: hidden;
}
.form-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  column-gap: 1em;
  font-size: 16px;
  min-height: 2em;
  padding: 0.5em 20px;
  position: relative;
}
.form-item[media*="prefers-color-scheme"] {
  display: none;
}
.form-item--link .icon-arrow_right {
  color: #86868b;
}
.form-item + .form-item::before {
  content: "";
  position: absolute;
  top: 0;
  left: 20px;
  right: 0;
  border-top: 0.5px solid var(--divider-color);
}
.form-item__input-wrapper {
  flex: 1;
  overflow: hidden;
  text-align: right;
}
.form-item__input {
  max-width: 100%;
}
.form-item .iconfont {
  margin-right: 4px;
}
.form-item input,
.form-item select {
  font-size: 14px;
  text-align: right;
}
.form-item input[type="checkbox"] {
  width: 1.25em;
  height: 1.25em;
}
input[type="number"] {
  width: 4em;
}
input[type="date"] {
  min-width: 6.4em;
}
input[type='checkbox'][role='switch'] {
  position: relative;
  display: inline-block;
  appearance: none;
  width: 40px;
  height: 24px;
  border-radius: 24px;
  background: #ccc;
  transition: 0.3s ease-in-out;
}
input[type='checkbox'][role='switch']::before {
  content: '';
  position: absolute;
  left: 2px;
  top: 2px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  transition: 0.3s ease-in-out;
}
input[type='checkbox'][role='switch']:checked {
  background: var(--color-primary);
}
input[type='checkbox'][role='switch']:checked::before {
  transform: translateX(16px);
}
.actions {
  margin: 15px;
}
.copyright {
  margin: 15px;
  margin-inline: 18px;
  font-size: 12px;
  color: #86868b;
}
.copyright a {
  color: #515154;
  text-decoration: none;
}
.preview.loading {
  pointer-events: none;
}
.icon-loading {
  display: inline-block;
  animation: 1s linear infinite spin;
}
@keyframes spin {
  0% {
    transform: rotate(0);
  }
  100% {
    transform: rotate(1turn);
  }
}
@media (prefers-color-scheme: light) {
  .form-item[media="(prefers-color-scheme: light)"] {
    display: flex;
  }
}
@media (prefers-color-scheme: dark) {
  :root {
    --divider-color: rgba(84,84,88,0.65);
    --card-background: #1c1c1e;
    --list-header-color: rgba(235,235,245,0.6);
  }
  body {
    background: #000;
    color: #fff;
  }
  input {
    background-color: rgb(58, 57, 57);
    color: var(--color-primary);
  }
  input[type='checkbox'][role='switch'] {
    background-color: rgb(56, 56, 60);
  }
  input[type='checkbox'][role='switch']::before {
    background-color: rgb(206, 206, 206);
  }
  select {
    background-color: rgb(82, 82, 82);
    border: none;
  }
  .form-item[media="(prefers-color-scheme: dark)"] {
    display: flex;
  }
}
`;

  const js =
`(() => {
  const settings = ${JSON.stringify({
    ...settings,
    useICloud: isUseICloud()
  })}
  const formItems = ${JSON.stringify(formItems)}

  window.invoke = (code, data, cb) => {
    ScriptableBridge.invoke(code, data, cb)
  }

  const formData = {}

  const createFormItem = (item) => {
    const value = settings[item.name] ?? item.default ?? null
    formData[item.name] = value;
    const label = document.createElement("label");
    label.className = "form-item";
    if (item.media) {
      label.setAttribute('media', item.media)
    }
    const div = document.createElement("div");
    div.innerText = item.label;
    label.appendChild(div);
    if (/^(select|multi-select)$/.test(item.type)) {
      const wrapper = document.createElement('div')
      wrapper.className = 'form-item__input-wrapper'
      const select = document.createElement('select')
      select.className = 'form-item__input'
      select.name = item.name
      select.multiple = item.type === 'multi-select'
      const map = (options, parent) => {
        for (const opt of (options || [])) {
          if (opt.children?.length) {
            const elGroup = document.createElement('optgroup')
            elGroup.label = opt.label
            map(opt.children, elGroup)
            parent.appendChild(elGroup)
          } else {
            const option = document.createElement('option')
            option.value = opt.value
            option.innerText = opt.label
            option.selected = Array.isArray(value) ? value.includes(opt.value) : (value === opt.value)
            parent.appendChild(option)
          }
        }
      }
      map(item.options || [], select)
      select.addEventListener('change', ({ target }) => {
        let { value } = target
        if (item.type === 'multi-select') {
          value = Array.from(target.selectedOptions).map(({ value }) => value)
        }
        formData[item.name] = value
        invoke('changeSettings', formData)
      })
      wrapper.appendChild(select)
      label.appendChild(wrapper)
    } else if (
      item.type === 'cell' ||
      item.type === 'page'
    ) {
      label.classList.add('form-item--link')
      const icon = document.createElement('i')
      icon.className = 'iconfont icon-arrow_right'
      label.appendChild(icon)
      label.addEventListener('click', () => {
        const { name } = item
        switch (name) {
          case 'backgroundImage':
            invoke('chooseBgImg')
            break
          case 'clearBackgroundImage':
            invoke('clearBgImg')
            break
          case 'reset':
            reset()
            break
          default:
            invoke('itemClick', item)
        }
      })
    } else {
      const input = document.createElement("input")
      input.className = 'form-item__input'
      input.name = item.name
      input.type = item.type || "text";
      input.enterKeyHint = 'done'
      input.value = value
      // Switch
      if (item.type === 'switch') {
        input.type = 'checkbox'
        input.role = 'switch'
        input.checked = value
        if (item.name === 'useICloud') {
          input.addEventListener('change', (e) => {
            invoke('moveSettings', e.target.checked)
          })
        }
      }
      if (item.type === 'number') {
        input.inputMode = 'decimal'
      }
      if (input.type === 'text') {
        input.size = 12
      }
      input.addEventListener("change", (e) => {
        formData[item.name] =
          item.type === 'switch'
          ? e.target.checked
          : item.type === 'number'
          ? Number(e.target.value)
          : e.target.value;
        invoke('changeSettings', formData)
      });
      label.appendChild(input);
    }
    return label
  }

  const createList = (list, title) => {
    const fragment = document.createDocumentFragment()

    let elBody;
    for (const item of list) {
      if (item.type === 'group') {
        const grouped = createList(item.items, item.label)
        fragment.appendChild(grouped)
      } else {
        if (!elBody) {
          const groupDiv = fragment.appendChild(document.createElement('div'))
          groupDiv.className = 'list'
          if (title) {
            const elTitle = groupDiv.appendChild(document.createElement('div'))
            elTitle.className = 'list__header'
            elTitle.textContent = title
          }
          elBody = groupDiv.appendChild(document.createElement('div'))
          elBody.className = 'list__body'
        }
        const label = createFormItem(item)
        elBody.appendChild(label)
      }
    }
    return fragment
  }

  const fragment = createList(formItems)
  document.getElementById('settings').appendChild(fragment)

  for (const btn of document.querySelectorAll('.preview')) {
    btn.addEventListener('click', (e) => {
      const target = e.currentTarget
      target.classList.add('loading')
      const icon = e.currentTarget.querySelector('.iconfont')
      const className = icon.className
      icon.className = 'iconfont icon-loading'
      invoke(
        'preview',
        e.currentTarget.dataset.size,
        () => {
          target.classList.remove('loading')
          icon.className = className
        }
      )
    })
  }

  const setFieldValue = (name, value) => {
    const input = document.querySelector(\`.form-item__input[name="\${name}"]\`)
    if (!input) return
    if (input.type === 'checkbox') {
      input.checked = value
    } else {
      input.value = value
    }
  }

  const reset = (items = formItems) => {
    for (const item of items) {
      if (item.type === 'group') {
        reset(item.items)
      } else if (item.type === 'page') {
        continue;
      } else {
        setFieldValue(item.name, item.default)
      }
    }
    invoke('removeSettings', formData)
  }
})()`;

  const html =
`<html>
  <head>
    <meta name='viewport' content='width=device-width, user-scalable=no'>
    <link rel="stylesheet" href="//at.alicdn.com/t/c/font_3772663_kmo790s3yfq.css" type="text/css">
    <style>${style}</style>
  </head>
  <body>
  ${head || ''}
  <section id="settings"></section>
  ${isFirstPage ? (previewsHTML + copyrightHTML) : ''}
  <script>${js}</script>
  </body>
</html>`;

  const webView = new WebView();
  const methods = {
    async preview (data) {
      const widget = await getWidget({ settings, family: data });
      widget[`present${data.replace(data[0], data[0].toUpperCase())}`]();
    },
    safari (data) {
      Safari.openInApp(data, true);
    },
    changeSettings (data) {
      Object.assign(settings, data);
      writeSettings(settings, { useICloud: settings.useICloud });
    },
    moveSettings (data) {
      settings.useICloud = data;
      moveSettings(data, settings);
    },
    removeSettings (data) {
      Object.assign(settings, data);
      clearBgImg();
      removeSettings(settings);
    },
    chooseBgImg (data) {
      chooseBgImg();
    },
    clearBgImg () {
      clearBgImg();
    },
    async itemClick (data) {
      if (data.type === 'page') {
        // `data` 经传到 HTML 后丢失了不可序列化的数据，因为需要从源数据查找
        const item = (() => {
          const find = (items) => {
            for (const el of items) {
              if (el.name === data.name) return el

              if (el.type === 'group') {
                const r = find(el.items);
                if (r) return r
              }
            }
            return null
          };
          return find(formItems)
        })();
        await present(item, false, { settings });
      } else {
        await onItemClick?.(data, { settings });
      }
    },
    native (data) {
      return onWebEvent?.(data)
    }
  };
  await loadHTML(
    webView,
    { html, baseURL: homePage },
    { methods }
  );

  const clearBgImg = () => {
    const { backgroundImage } = settings;
    delete settings.backgroundImage;
    if (backgroundImage && fm.fileExists(backgroundImage)) {
      fm.remove(backgroundImage);
    }
    writeSettings(settings, { useICloud: settings.useICloud });
    toast(i18n(['Cleared success!', '背景已清除']));
  };

  const chooseBgImg = async () => {
    try {
      const image = await Photos.fromLibrary();
      cache.writeImage('bg.png', image);
      const imgPath = fm.joinPath(cache.cacheDirectory, 'bg.png');
      settings.backgroundImage = imgPath;
      writeSettings(settings, { useICloud: settings.useICloud });
    } catch (e) {
      console.log('[info] 用户取消选择图片');
    }
  };

  webView.present();
  // ======= web end =========
};

/**
 * @param {Options} options
 */
const withSettings = async (options) => {
  const { formItems, onItemClick, ...restOptions } = options;
  return present({
    formItems: [
      {
        label: i18n(['Common', '通用']),
        type: 'group',
        items: [
          {
            label: i18n(['Sync with iCloud', 'iCloud 同步']),
            type: 'switch',
            name: 'useICloud',
            default: false
          },
          {
            label: i18n(['Background', '背景']),
            type: 'page',
            name: 'background',
            formItems: [
              {
                label: i18n(['Background', '背景']),
                type: 'group',
                items: [
                  {
                    name: 'backgroundColorLight',
                    type: 'color',
                    label: i18n(['Background color', '背景色']),
                    media: '(prefers-color-scheme: light)',
                    default: '#ffffff'
                  },
                  {
                    name: 'backgroundColorDark',
                    type: 'color',
                    label: i18n(['Background color', '背景色']),
                    media: '(prefers-color-scheme: dark)',
                    default: '#242426'
                  },
                  {
                    label: i18n(['Background image', '背景图']),
                    type: 'cell',
                    name: 'backgroundImage'
                  }
                ]
              },
              {
                type: 'group',
                items: [
                  {
                    label: i18n(['Clear background image', '清除背景图']),
                    type: 'cell',
                    name: 'clearBackgroundImage'
                  }
                ]
              }
            ]
          },
          {
            label: i18n(['Reset', '重置']),
            type: 'cell',
            name: 'reset'
          }
        ]
      },
      {
        label: i18n(['Settings', '设置']),
        type: 'group',
        items: formItems
      }
    ],
    onItemClick: (item, ...args) => {
      onItemClick?.(item, ...args);
    },
    ...restOptions
  }, true)
};

const cache = useCache();
const ScriptName = Script.name();

const named = SFSymbol.named;
SFSymbol.named = (str) => {
  const current = named(str);
  if (!current.image) {
    return named('photo')
  }
  return current
};
/**
 * md5 加密字符串
 * @param {string} str 要加密成md5的数据
 */
// prettier-ignore
// eslint-disable-next-line
const md5 = (str)=>{function d(n,t){var r=(65535&n)+(65535&t);return (((n>>16)+(t>>16)+(r>>16))<<16)|(65535&r)}function f(n,t,r,e,o,u){return d(((c=d(d(t,n),d(e,u)))<<(f=o))|(c>>>(32-f)),r);var c,f;}function l(n,t,r,e,o,u,c){return f((t&r)|(~t&e),n,t,o,u,c)}function v(n,t,r,e,o,u,c){return f((t&e)|(r&~e),n,t,o,u,c)}function g(n,t,r,e,o,u,c){return f(t^r^e,n,t,o,u,c)}function m(n,t,r,e,o,u,c){return f(r^(t|~e),n,t,o,u,c)}function i(n,t){var r,e,o,u;(n[t>>5]|=128<<t%32),(n[14+(((t+64)>>>9)<<4)]=t);for(var c=1732584193,f=-271733879,i=-1732584194,a=271733878,h=0;h<n.length;h+=16)(c=l((r=c),(e=f),(o=i),(u=a),n[h],7,-680876936)),(a=l(a,c,f,i,n[h+1],12,-389564586)),(i=l(i,a,c,f,n[h+2],17,606105819)),(f=l(f,i,a,c,n[h+3],22,-1044525330)),(c=l(c,f,i,a,n[h+4],7,-176418897)),(a=l(a,c,f,i,n[h+5],12,1200080426)),(i=l(i,a,c,f,n[h+6],17,-1473231341)),(f=l(f,i,a,c,n[h+7],22,-45705983)),(c=l(c,f,i,a,n[h+8],7,1770035416)),(a=l(a,c,f,i,n[h+9],12,-1958414417)),(i=l(i,a,c,f,n[h+10],17,-42063)),(f=l(f,i,a,c,n[h+11],22,-1990404162)),(c=l(c,f,i,a,n[h+12],7,1804603682)),(a=l(a,c,f,i,n[h+13],12,-40341101)),(i=l(i,a,c,f,n[h+14],17,-1502002290)),(c=v(c,(f=l(f,i,a,c,n[h+15],22,1236535329)),i,a,n[h+1],5,-165796510,)),(a=v(a,c,f,i,n[h+6],9,-1069501632)),(i=v(i,a,c,f,n[h+11],14,643717713)),(f=v(f,i,a,c,n[h],20,-373897302)),(c=v(c,f,i,a,n[h+5],5,-701558691)),(a=v(a,c,f,i,n[h+10],9,38016083)),(i=v(i,a,c,f,n[h+15],14,-660478335)),(f=v(f,i,a,c,n[h+4],20,-405537848)),(c=v(c,f,i,a,n[h+9],5,568446438)),(a=v(a,c,f,i,n[h+14],9,-1019803690)),(i=v(i,a,c,f,n[h+3],14,-187363961)),(f=v(f,i,a,c,n[h+8],20,1163531501)),(c=v(c,f,i,a,n[h+13],5,-1444681467)),(a=v(a,c,f,i,n[h+2],9,-51403784)),(i=v(i,a,c,f,n[h+7],14,1735328473)),(c=g(c,(f=v(f,i,a,c,n[h+12],20,-1926607734)),i,a,n[h+5],4,-378558,)),(a=g(a,c,f,i,n[h+8],11,-2022574463)),(i=g(i,a,c,f,n[h+11],16,1839030562)),(f=g(f,i,a,c,n[h+14],23,-35309556)),(c=g(c,f,i,a,n[h+1],4,-1530992060)),(a=g(a,c,f,i,n[h+4],11,1272893353)),(i=g(i,a,c,f,n[h+7],16,-155497632)),(f=g(f,i,a,c,n[h+10],23,-1094730640)),(c=g(c,f,i,a,n[h+13],4,681279174)),(a=g(a,c,f,i,n[h],11,-358537222)),(i=g(i,a,c,f,n[h+3],16,-722521979)),(f=g(f,i,a,c,n[h+6],23,76029189)),(c=g(c,f,i,a,n[h+9],4,-640364487)),(a=g(a,c,f,i,n[h+12],11,-421815835)),(i=g(i,a,c,f,n[h+15],16,530742520)),(c=m(c,(f=g(f,i,a,c,n[h+2],23,-995338651)),i,a,n[h],6,-198630844,)),(a=m(a,c,f,i,n[h+7],10,1126891415)),(i=m(i,a,c,f,n[h+14],15,-1416354905)),(f=m(f,i,a,c,n[h+5],21,-57434055)),(c=m(c,f,i,a,n[h+12],6,1700485571)),(a=m(a,c,f,i,n[h+3],10,-1894986606)),(i=m(i,a,c,f,n[h+10],15,-1051523)),(f=m(f,i,a,c,n[h+1],21,-2054922799)),(c=m(c,f,i,a,n[h+8],6,1873313359)),(a=m(a,c,f,i,n[h+15],10,-30611744)),(i=m(i,a,c,f,n[h+6],15,-1560198380)),(f=m(f,i,a,c,n[h+13],21,1309151649)),(c=m(c,f,i,a,n[h+4],6,-145523070)),(a=m(a,c,f,i,n[h+11],10,-1120210379)),(i=m(i,a,c,f,n[h+2],15,718787259)),(f=m(f,i,a,c,n[h+9],21,-343485551)),(c=d(c,r)),(f=d(f,e)),(i=d(i,o)),(a=d(a,u));return [c,f,i,a]}function a(n){for(var t='',r=32*n.length,e=0;e<r;e+=8)t+=String.fromCharCode((n[e>>5]>>>e%32)&255);return t}function h(n){var t=[];for(t[(n.length>>2)-1]=void 0,e=0;e<t.length;e+=1)t[e]=0;for(var r=8*n.length,e=0;e<r;e+=8)t[e>>5]|=(255&n.charCodeAt(e/8))<<e%32;return t}function e(n){for(var t,r='0123456789abcdef',e='',o=0;o<n.length;o+=1)(t=n.charCodeAt(o)),(e+=r.charAt((t>>>4)&15)+r.charAt(15&t));return e}function r(n){return unescape(encodeURIComponent(n))}function o(n){return a(i(h((t=r(n))),8*t.length));var t;}function u(n,t){return (function(n,t){var r,e,o=h(n),u=[],c=[];for(u[15]=c[15]=void 0,16<o.length&&(o=i(o,8*n.length)),r=0;r<16;r+=1)(u[r]=909522486^o[r]),(c[r]=1549556828^o[r]);return((e=i(u.concat(h(t)),512+8*t.length)),a(i(c.concat(e),640)))})(r(n),r(t))}function t(n,t,r){return t?(r?u(t,n):e(u(t,n))):r?o(n):e(o(n))}return t(str)};

const reopenScript = () => {
  Safari.open(`scriptable:///run/${encodeURIComponent(ScriptName)}`);
};

// 获取 Request 对象
const getRequest = (url = '') => {
  return new Request(url)
};

// 发起请求
const http = async (
  options = { headers: {}, url: '' },
  type = 'JSON',
  onError = () => {
    return SFSymbol.named('photo').image
  }
) => {
  let request;
  try {
    if (type === 'IMG') {
      const fm = FileManager.local();
      const fileName = await md5(options.url);
      const filePath = fm.joinPath(cache.cacheDirectory, fileName);
      request = getRequest(options.url);
      let response;
      if (await fm.readString(filePath)) {
        request.loadImage().then((res) => {
          cache.writeImage(filePath, res);
        });
        return Image.fromFile(filePath)
      } else {
        response = await request.loadImage();
        cache.writeImage(filePath, response);
      }
      return response
    }
    request = getRequest();
    Object.keys(options).forEach((key) => {
      request[key] = options[key];
    });
    request.headers = { ...options.headers };

    if (type === 'JSON') {
      return await request.loadJSON()
    }
    if (type === 'STRING') {
      return await request.loadString()
    }
    return await request.loadJSON()
  } catch (e) {
    console.error('error:\n' + e + '\n' + type);
    if (type === 'IMG') return onError?.()
  }
};

// request 接口请求
const httpRequest = {
  get: (url = '', options = {}, type = 'JSON') => {
    let params = { ...options, method: 'GET' };
    if (typeof url === 'object') {
      params = { ...params, ...url };
    } else {
      params.url = url;
    }
    let _type = type;
    if (typeof options === 'string') _type = options;
    return http(params, _type)
  },
  post: (url = '', options = {}, type = 'JSON') => {
    let params = { ...options, method: 'POST' };
    if (typeof url === 'object') {
      params = { ...params, ...url };
    } else {
      params.url = url;
    }
    let _type = type;
    if (typeof options === 'string') _type = options;
    return http(params, _type)
  }
};

// 获取 boxJS 数据
const getBoxJsData = async (options = {}) => {
  const params = Object.assign({
    boxJsSite: 'boxjs.com',
    key: ''
  }, options);
  const key = params.key;
  try {
    let url = 'http://' + params.boxJsSite + '/query/boxdata';
    if (key) url = 'http://' + params.boxJsSite + '/query/data/' + key;
    const boxdata = await httpRequest.get(
      url,
      key ? { timeoutInterval: 1 } : {}
    );

    if (boxdata.val) return boxdata.val

    return boxdata.datas
  } catch (e) {
    console.error(
      `${ScriptName} - BoxJS 数据读取失败\n,
      请检查 BoxJS 域名是否为代理复写的域名，如（boxjs.net 或 boxjs.com）。\n若没有配置 BoxJS 相关模块，请点击通知查看教程：\n
      https://chavyleung.gitbook.io/boxjs/awesome/videos`
    );
    return ''
  }
};

const getRefreshTime = (refreshAfterDate) => {
  refreshAfterDate = refreshAfterDate || 30;
  if (refreshAfterDate <= 0) refreshAfterDate = 30;
  const refreshTime = parseInt(refreshAfterDate) * 1000 * 60;
  const timeStr = new Date().getTime() + refreshTime;
  return new Date(timeStr)
};

/**
 * 渲染标题内容
 * @param {object} widget 组件对象
 * @param {string} icon 图标地址
 * @param {string} title 标题内容
 * @param {bool|color} color 字体的颜色（自定义背景时使用，默认系统）
 */
const renderHeader = async (widget, icon, title, color = false) => {
  const header = widget.addStack();
  header.centerAlignContent();
  try {
    const image = await httpRequest.get(icon, 'IMG');
    const _icon = header.addImage(image);
    _icon.imageSize = new Size(14, 14);
    _icon.cornerRadius = 4;
  } catch (e) {
    console.error(`renderHeader：${JSON.stringify(e)}`);
  }
  header.addSpacer(10);
  const _title = header.addText(title);
  if (color) _title.textColor = color;
  _title.textOpacity = 0.7;
  _title.font = Font.boldSystemFont(12);
  _title.lineLimit = 1;
  widget.addSpacer(15);
  return widget
};

const renderNone = async (widget, message = '暂无数据') => {
  widget.addSpacer();
  const noneView = widget.addStack();
  noneView.addSpacer();
  const noneText = noneView.addText(message);
  noneText.font = new Font('SF Mono', 12);
  noneText.textColor = new Color('#333333');
  noneView.addSpacer();

  return widget
};

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
};

const colorRecommend = {
  color: '#fefefe',
  backgroundColor: '#1c1c1c'
};

// 脚本内部变量
let fontColor = new Color(preference.colorLight);
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
];
let feedsList = [];

const getHeaders = async () => {
  try {
    const csrfToken = await getBoxJsData({ key: 'follow_csrfToken' });
    const cookie = await getBoxJsData({ key: 'follow_cookie' });
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
    console.error(`getHeaders:\n${error.message}`);
  }
};
/**
 * 返回订阅列表标题的数组
 * @returns {Array}
 */
const getFeedsListTitles = async () => {
  feedsList = await getFeedsList();
  if (feedsList.length === 0) return []
  const arr = [];
  arr.push({ label: '全部', value: '' });
  for (let i = 0; i < feedsList.length; i++) {
    const item = feedsList[i];
    arr.push({ label: item.feeds.title, value: item.feedId });
  }  return arr
};
/**
 * 获取订阅列表
 * @returns {Array} 订阅列表
 */
const getFeedsList = async () => {
  try {
    const url = 'https://api.follow.is/subscriptions';
    const res = await httpRequest.get(url, { headers: await getHeaders() });
    // log(res)
    if (res.code === 0) {
      return res.data
    } else {
      console.log(res.message);
      return []
    }
  } catch (error) {
    console.error(`getFeedsList:\n${error.message}`);
    return []
  }
};
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
    };
    const url = `https://api.follow.is/entries/check-new?view=${params.view}&read=${params.read}&insertedAfter=${params.insertedAfter}&feedId=${params.feedId}`;
    const res = await httpRequest.get(url, { headers: await getHeaders() });
    // log(res)
    if (res.code === 0) {
      if (res.data.has_new) {
        preference.insertedAfter = new Date(res.data.lastest_at).getTime();
        writeSettings(preference, { useICloud: preference.useICloud });
      }
      return res.data.has_new
    } else {
      log(res.message);
    }
  } catch (error) {
    console.error(`checkNew:\n${error.message}`);
  }
  return false
};
/**
 * 获取订阅文章列表
 * @returns {Array} 列表
 */
const getList = async () => {
  const cache = useCache();
  const lastDataFileCacheKey = preference.feedId ? `last_data_${preference.feedId}.json` : 'last_data.json';
  let lastData = cache.readJSON(lastDataFileCacheKey) || [];
  try {
    const hasNew = await checkNew();
    if (hasNew) {
      const url = 'https://api.follow.is/entries';
      const params = {
        view: preference.view,
        read: false,
        isArchived: false,
        feedId: preference.feedId
      };
      const res = await httpRequest.post(url, { body: JSON.stringify(params), headers: await getHeaders() });
      // log(res)
      if (res.code === 0) {
        const list = [];
        if (res.data.length > 0) {
          const resData = res.data;
          for (let i = 0; i < Math.min(preference.maxListCount, resData.length); i++) {
            const data = resData[i];
            const item = {
              id: data.entries.id,
              site: data.feeds.title,
              url: data.entries.url,
              title: data.entries.title || data.entries.description,
              media: data.entries.media ? data.entries.media[0].url : '',
              insertedAt: data.entries.insertedAt
            };
            list.push(item);
          }
        }

        lastData = list;
        cache.writeJSON(lastDataFileCacheKey, lastData);
        return lastData
      } else {
        log(res.message);
        return lastData
      }
    } else {
      return lastData
    }
  } catch (error) {
    console.error(`getList:\n${error.message}`);
    return lastData
  }
};

// 文字列表
const getListTextStack = (list, listStack) => {
  listStack.spacing = 5;
  for (let i = 0; i < list.length; i++) {
    const data = list[i];
    const listItemStack = listStack.addStack();
    listItemStack.spacing = 5;
    listItemStack.layoutVertically();
    listItemStack.url = list[i].url;
    const itemSite = listItemStack.addText(data.site);
    itemSite.textColor = fontColor;
    itemSite.textOpacity = 0.7;
    itemSite.font = new Font('SF Mono', 12);
    const itemTitle = listItemStack.addText(data.title);
    itemTitle.textColor = fontColor;
    itemTitle.font = new Font('SF Mono', 12);
  }
};

// 缩略图列表
const getListThumbStack = async (list, listStack) => {
  for (let i = 0; i < list.length; i++) {
    const data = list[i];
    const listItemStack = listStack.addStack();
    listItemStack.url = data.url;
    listItemStack.layoutHorizontally();
    const leftStack = listItemStack.addStack();
    leftStack.layoutVertically();
    leftStack.addSpacer();
    leftStack.spacing = 5;
    leftStack.size = new Size(240, 0);
    const siteText = leftStack.addText(data.site);
    siteText.textColor = fontColor;
    siteText.textOpacity = 0.7;
    siteText.font = new Font('SF Mono', 12);
    const titleText = leftStack.addText(data.title);
    titleText.textColor = fontColor;
    titleText.font = new Font('SF Mono', 12);
    const rightStack = listItemStack.addStack();
    const img = data.media ? await httpRequest.get(data.media, 'IMG') : SFSymbol.named('photo').image;
    const thumb = rightStack.addImage(img);
    thumb.imageSize = new Size(40, 40);
    thumb.imageOpacity = data.media ? 1 : 0.5;
    rightStack.setPadding(10, 15, 0, 0);
  }
};
/**
 * @param {WidgetStack} container
 */
const getListStack = async (listStack, list) => {
  // 文字列表
  if (preference.showThumb) {
    await getListThumbStack(list, listStack);
  } else {
    getListTextStack(list, listStack);
  }
};
const createWidget = async (data) => {
  const widget = new ListWidget();
  if (config.widgetFamily === 'small') {
    const textStack = widget.addStack();
    textStack.addText('不支持');
    return widget
  }
  const headerStack = widget.addStack();
  headerStack.url = 'https://app.follow.is/';
  await renderHeader(headerStack, preference.logo, preference.name, fontColor);
  headerStack.addSpacer();
  headerStack.spacing = 5;

  const timeStack = headerStack.addStack();
  const lastTimerText = timeStack.addText(`${timeOffset(new Date(preference.insertedAfter))}`);
  lastTimerText.textColor = fontColor;
  lastTimerText.textOpacity = 0.3;
  lastTimerText.font = new Font('SF Mono', 12);

  if (data.length === 0) {
    return renderNone(widget, '暂无新的订阅')
  }

  widget.addSpacer();
  let listCount = preference.showThumb ? preference.minListThumbCount : preference.minListCount;
  if (config.widgetFamily === 'large') {
    listCount = preference.showThumb ? preference.maxListThumbCount : preference.maxListCount;
  }
  const list = [];
  for (let i = 0; i < Math.min(listCount, data.length); i++) {
    list.push(data[i]);
  }
  const listStack = widget.addStack();
  listStack.layoutVertically();
  await getListStack(listStack, list);
  widget.addSpacer();
  return widget
};

const setColorRecommend = () => {
  preference.colorLight = colorRecommend.color;
  preference.backgroundColorLight = colorRecommend.backgroundColor;
  preference.colorDark = colorRecommend.color;
  preference.backgroundColorDark = colorRecommend.backgroundColor;
  writeSettings(preference, { useICloud: preference.useICloud });
  reopenScript();
};

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
        },
        {
          name: 'useColorRecommend',
          type: 'cell',
          label: i18n(['color recommend', '推荐配色'])
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
  onItemClick: ({ name }) => {
    if (name === 'useColorRecommend') {
      setColorRecommend();
    }
  },
  homePage: 'https://github.com/bmqy/scriptable-scripts',
  render: async ({ settings, family }) => {
    family && (config.widgetFamily = family);
    Object.assign(preference, settings);
    fontColor = Color.dynamic(
      new Color(preference.colorLight),
      new Color(preference.colorDark)
    );
    const res = await getList();
    const widget = await createWidget(res);
    widget.refreshAfterDate = getRefreshTime(preference.refreshAfterDate);
    return widget
  }
});

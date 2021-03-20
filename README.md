# Learn Vue Router

源码级别学习`Vue Router`，删除一些与学习源码无关的文件夹和文件。

基于[v3.5.1 release](https://github.com/vuejs/vue-router/tree/v3.5.1)

执行`yarn run dev:dist`后即可构建出带sourcemap的代码，可以使用[demo/index.html](./demo/index.html)进行断点调试。

安装了`babel-node`以便在[test/index.js](./test/index.js)中使用`yarn run test`测试你想测试的代码。不过要注意将测试代码和依赖代码中的flow类型注释删除掉。

此版本中进行了比较多的学习注释，可以边看Readme边捋源码。

理解源码的几个小技巧

1. 结合官方文档的api用法，先过一遍Typescript类型定义，或是flow也可，熟悉各个环节数据的结构。
2. **囫囵吞枣**地过大体流程，再次结合官方文档的api用法，逐个api再过一遍（有很多冷门api可能都未曾用过）。
3. 利用demo进行console + 断点调试大法，较细致地串联每一个环节，这个环节是比较费时的，也是最提升代码理解力的；多细致算细致？因为每一次调试对源码的理解会逐渐加深，对“细致”的标准也会变化。我的建议是，每次调试不要因为某一个细节始终不理解就一直卡在那里，可以把局部逻辑视为“黑盒”，只要理解到它在干嘛即可，内部环节不理解马上跳过，留给下一波逐个攻克。这样每一个“黑盒”也会慢慢变小。

## 认识几个比较主要的类型定义

1. `RouteConfig` 路由配置对象

   ```typescript
   interface _RouteConfigBase {
     path: string
     name?: string
     children?: RouteConfig[]
     redirect?: RedirectOption
     alias?: string | string[]
     meta?: any
     beforeEnter?: NavigationGuard
     caseSensitive?: boolean
     pathToRegexpOptions?: PathToRegexpOptions
   }
   
   interface RouteConfigSingleView extends _RouteConfigBase {
     component?: Component
     props?: boolean | Object | RoutePropsFunction
   }
   
   interface RouteConfigMultipleViews extends _RouteConfigBase {
     components?: Dictionary<Component>
     props?: Dictionary<boolean | Object | RoutePropsFunction>
   }
   
   export type RouteConfig = RouteConfigSingleView | RouteConfigMultipleViews
   ```

   

2. `RouteRecord` 路由记录对象

   ```typescript
   export interface RouteRecord {
     path: string
     regex: RegExp
     components: Dictionary<Component>
     instances: Dictionary<Vue>
     name?: string
     parent?: RouteRecord
     redirect?: RedirectOption
     matchAs?: string
     meta: any
     beforeEnter?: (
       route: Route,
       redirect: (location: RawLocation) => void,
       next: () => void
     ) => any
     props:
       | boolean
       | Object
       | RoutePropsFunction
       | Dictionary<boolean | Object | RoutePropsFunction>
   }
   ```

   

3. `Route`  路由对象

   ```typescript
   export interface Route {
     path: string
     name?: string | null
     hash: string
     query: Dictionary<string | (string | null)[]>
     params: Dictionary<string>
     fullPath: string
     matched: RouteRecord[]
     redirectedFrom?: string
     meta?: any
   }
   ```

   

4. `Location` 地址对象

   ```typescript
   export interface Location {
     name?: string
     path?: string
     hash?: string
     query?: Dictionary<string | (string | null)[] | null | undefined>
     params?: Dictionary<string>
     append?: boolean
     replace?: boolean
   }
     
   export type RawLocation = string | Location
   ```

## 思维导图

![初始化](./初始化.png)

![路由更新](./路由更新.png)

## 解析核心流程和特性

### 1. transitionTo

[base.js](./src/history/base.js)

```typescript
// transitionTo签名
transitionTo(location: RawLocation, onComplete?: Function, onAbort?: Function)
/** transitionTo干的事情 **/
// 1. 把RawLocation转换成Route路由对象，若出错依次执行errorCbs
let route
route = this.router.match(location, this.current)
// 2. 实际执行confirmTransition方法，传入上一步获取的route以及一个onComplete方法、一个onAbort方法(对transitionTo入参方法的加工)



// confirmTransition签名
confirmTransition(route: Route, onComplete: Function, onAbort?: Function)
/** confirmTransition干的事情 **/
/**
* 1. 定义一个abort函数：依次执行errorCbs，再执行transitionTo传进来的onAbort
* 2. 确保前后transitionTo的不是同一个路由对象，否则报错
* 3. 解析出属于updated的RouteRecord;属于actived的RouteRecord;属于deactivated的RouteRecord
* 4. 将上述分好类的RouteRecord分别传给对应生命周期的路由守卫函数，先形成一个路由守卫函数队列A
* 5. 定义导航守卫函数的迭代执行器
* 6. 迭代器执行路由守卫函数队列A，在第一次迭代完成后再定义一个路由守卫函数队列B
* 7. 再次用迭代器执行路由守卫函数队列B,在第二次迭代完成之后执行传入的onComplete
* 整个过程中如果出错则执行最先定义的abort函数
* /

```

### 3. 嵌套的路由/视图表；模块化的、基于组件的路由配置

1. 路由配置表转换成路由记录映射的过程[create-route-map](./src/create-route-map.js)
2. [route-view](./src/components/view.js)是如何处理嵌套路由的渲染问题的？关键：递归渲染；缓存组件

### 4. 路由参数、查询、通配符

1. 地址对象转换成路由对象的过程[createRoute](./src/util/route.js)

2. `this.$route`怎么变成当前路由对象的？

   ```javascript
   // install.js -- line 42~44
   // this.$route => this._routerRoot._route
   Object.defineProperty(Vue.prototype, '$route', {
     get () { return this._routerRoot._route }
   })
   ```
   
   ```javascript
   // this => this._routerRoot
   // this._route => this._routerRouter._route => 响应化的this._router.history.current
   this._routerRoot = this // install.js -- line 24
   Vue.util.defineReactive(this, '_route', this._router.history.current) // install.js -- line 27
   ```

### 5. 基于 Vue.js 过渡系统的视图过渡效果

路由切换本质上就是组件动态切换渲染，所以 Vue.js 应用在组件上的过渡系统在VueRouter上仍然适用。VueRouter本身未进行特殊的处理。

### 6. 细粒度的导航控制

此处我理解指的是导航守卫的执行

见[transitionTo](#1-transitionto)解析，如何将收集起来的路由守卫函数按照生命周期执行

### 7. 带有自动激活的 CSS class 的链接

[router-link](./src/components/link.js)组件实现

### 8. HTML5 历史模式或 hash 模式，在 IE9 中自动降级

```javascript
// index.js -- line 52~63
// 根据配置的fallback值、是否支持pushState API、运行环境来进行mode的选择
let mode = options.mode || 'hash'
// 当浏览器不支持pushState时是否回退到hash模式
this.fallback =
  mode === 'history' && !supportsPushState && options.fallback !== false
if (this.fallback) {
  mode = 'hash'
}
if (!inBrowser) {
  mode = 'abstract'
}
// 拿到最终mode
this.mode = mode
```

### 9. 自定义的滚动条行为

[scroll](./src/util/scroll.js)

在每次处理滚动逻辑(handleScroll)之前，都会有`supportScroll`的检测，其中包含`supportPushState`的检测；这也是为什么滚动行为只能在支持`history.pushState`API的浏览器中表现正常

本质是利用`window.scrollTo`来滚动到计算好的position`{x: number, y: number}`

另外保留滚动位置的原理时在pushState和popState时都会缓存`{x: window.pageXOffset, y: window.pageYOffset}`即一个有值的`savedPosition`

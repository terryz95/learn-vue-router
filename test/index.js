/* @flow */

import Regexp from "path-to-regexp";

function cleanPath(path) {
  return path.replace(/\/\//g, "/");
}

// 路由配置表 => {path数组, path到RouteRecord的映射, name到RouteRecord的映射}
function createRouteMap(
  routes,
  oldPathList,
  oldPathMap,
  oldNameMap,
  parentRoute
) {
  // the path list is used to control path matching priority
  const pathList = oldPathList || [];
  // $flow-disable-line
  const pathMap = oldPathMap || Object.create(null);
  // $flow-disable-line
  const nameMap = oldNameMap || Object.create(null);

  routes.forEach((route) => {
    addRouteRecord(pathList, pathMap, nameMap, route, parentRoute);
  });

  // ensure wildcard routes are always at the end
  for (let i = 0, l = pathList.length; i < l; i++) {
    if (pathList[i] === "*") {
      pathList.push(pathList.splice(i, 1)[0]);
      l--;
      i--;
    }
  }

  // if (process.env.NODE_ENV === 'development') {
  //   // warn if routes do not include leading slashes
  //   const found = pathList
  //   // check for missing leading slash
  //     .filter(path => path && path.charAt(0) !== '*' && path.charAt(0) !== '/')

  //   if (found.length > 0) {
  //     const pathNames = found.map(path => `- ${path}`).join('\n')
  //     warn(false, `Non-nested routes must include a leading slash character. Fix the following routes: \n${pathNames}`)
  //   }
  // }

  return {
    pathList,
    pathMap,
    nameMap,
  };
}

function addRouteRecord(pathList, pathMap, nameMap, route, parent, matchAs) {
  const { path, name } = route;
  // if (process.env.NODE_ENV !== 'production') {
  //   assert(path != null, `"path" is required in a route configuration.`)
  //   assert(
  //     typeof route.component !== 'string',
  //     `route config "component" for path: ${String(
  //       path || name
  //     )} cannot be a ` + `string id. Use an actual component instead.`
  //   )

  //   warn(
  //     // eslint-disable-next-line no-control-regex
  //     !/[^\u0000-\u007F]+/.test(path),
  //     `Route with path "${path}" contains unencoded characters, make sure ` +
  //       `your path is correctly encoded before passing it to the router. Use ` +
  //       `encodeURI to encode static segments of your path.`
  //   )
  // }

  const pathToRegexpOptions = route.pathToRegexpOptions || {};
  // 格式化path
  const normalizedPath = normalizePath(
    path,
    parent,
    pathToRegexpOptions.strict
  );

  if (typeof route.caseSensitive === "boolean") {
    pathToRegexpOptions.sensitive = route.caseSensitive;
  }

  const record = {
    path: normalizedPath,
    regex: compileRouteRegex(normalizedPath, pathToRegexpOptions),
    components: route.components || { default: route.component },
    alias: route.alias
      ? typeof route.alias === "string"
        ? [route.alias]
        : route.alias
      : [],
    instances: {},
    enteredCbs: {},
    name,
    parent,
    matchAs,
    redirect: route.redirect,
    beforeEnter: route.beforeEnter,
    meta: route.meta || {},
    props:
      route.props == null
        ? {}
        : route.components
        ? route.props
        : { default: route.props },
  };

  if (route.children) {
    // Warn if route is named, does not redirect and has a default child route.
    // If users navigate to this route by name, the default child will
    // not be rendered (GH Issue #629)
    // if (process.env.NODE_ENV !== 'production') {
    //   if (
    //     route.name &&
    //     !route.redirect &&
    //     route.children.some(child => /^\/?$/.test(child.path))
    //   ) {
    //     warn(
    //       false,
    //       `Named Route '${route.name}' has a default child route. ` +
    //         `When navigating to this named route (:to="{name: '${
    //           route.name
    //         }'"), ` +
    //         `the default child route will not be rendered. Remove the name from ` +
    //         `this route and use the name of the default child route for named ` +
    //         `links instead.`
    //     )
    //   }
    // }
    route.children.forEach((child) => {
      const childMatchAs = matchAs
        ? cleanPath(`${matchAs}/${child.path}`)
        : undefined;
      addRouteRecord(pathList, pathMap, nameMap, child, record, childMatchAs);
    });
  }

  if (!pathMap[record.path]) {
    pathList.push(record.path);
    pathMap[record.path] = record;
  }

  if (route.alias !== undefined) {
    const aliases = Array.isArray(route.alias) ? route.alias : [route.alias];
    for (let i = 0; i < aliases.length; ++i) {
      const alias = aliases[i];
      // if (process.env.NODE_ENV !== 'production' && alias === path) {
      //   warn(
      //     false,
      //     `Found an alias with the same value as the path: "${path}". You have to remove that alias. It will be ignored in development.`
      //   )
      //   // skip in dev to make it work
      //   continue
      // }

      const aliasRoute = {
        path: alias,
        children: route.children,
      };
      addRouteRecord(
        pathList,
        pathMap,
        nameMap,
        aliasRoute,
        parent,
        record.path || "/" // matchAs
      );
    }
  }

  if (name) {
    if (!nameMap[name]) {
      nameMap[name] = record;
    } else if (process.env.NODE_ENV !== "production" && !matchAs) {
      // warn(
      //   false,
      //   `Duplicate named routes definition: ` +
      //     `{ name: "${name}", path: "${record.path}" }`
      // )
    }
  }
}

function compileRouteRegex(path, pathToRegexpOptions) {
  const regex = Regexp(path, [], pathToRegexpOptions);
  // if (process.env.NODE_ENV !== 'production') {
  //   const keys: any = Object.create(null)
  //   regex.keys.forEach(key => {
  //     warn(
  //       !keys[key.name],
  //       `Duplicate param keys in route with path: "${path}"`
  //     )
  //     keys[key.name] = true
  //   })
  // }
  return regex;
}

function normalizePath(path, parent, strict) {
  if (!strict) path = path.replace(/\/$/, "");
  if (path[0] === "/") return path;
  if (parent == null) return path;
  return cleanPath(`${parent.path}/${path}`);
}

const Foo = { template: "<div>foo</div>" };
const Bar = { template: "<div>bar</div>" };

const routes = [
  {
    path: "/foo",
    name: "foo",
    component: Foo,
    meta: { title: "Foo" },
    alias: "fooAlias",
    children: [
      {
        path: "sub",
        component: Foo,
        children: [{ path: "baz", component: Foo }],
      },
    ],
  },
  { path: "/bar", component: Bar },
];

console.log(createRouteMap(routes));

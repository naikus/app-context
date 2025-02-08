/* global Map */

/**
 * @typedef {import("../types").ModuleDefn} ModuleDefn
 * @typedef {import("../types").AppContext} AppContext
 * @typedef {import("./namespaced-emitter").NsEventEmitter} NsEventEmitter;
 * @typedef {import("./namespaced-emitter").NsEventListener} NsEventListener;
 * @typedef {import("./dgraph").V} V
 * @typedef {import("./dgraph").E} E
 * @typedef {import("./dgraph").DGraph<any>} DepGraph
 */


/**
 * @typedef {Object} ModuleInfo 
 * @property {string} name
 * @property {any} module
 * @property {string[]} dependencies
 * @property {ModuleDefn} moduleDefn
 * @property {boolean} initialized
 */


/**
 * @typedef {Object} Traversal
 * @property {DepGraph} graph
 * @property {Set<V>} visited
 * @property {Array<string>} path,
 * @property {Array<string>|null} circular
 */


const {AsyncLocalStorage} = require("async_hooks"),
    createNsEmitter = require("./namespaced-emitter"),
    createGraph = require("./dgraph");

/**
 * Application context provides access to other modules installed as part of the application. It provides
 * API to register modules a rudimentary dependency management for modules that depend on other modules
 * Usage
 *
 * const context = createAppContext();
 * context.registerModule({
 *  name: "mymodule",
 *  async initialize(ctx) {
 *    return new Promise((res, rej) => {
 *      ctx.dependency(["a", "b"], (a, b) => {
 *        const service = createMyService(a, b);
 *        resolve(service);
 *      });
 *    })
 *  }
 * })
 *
 * @return {AppContext} The application context that is passed to each module's initialization
 * function
 */
function createAppContext() {
  /**
   * @type {Map<string, ModuleInfo>}
   */
  const modules = new Map(),
      /* type {DepGraph} */
      depGraph = createGraph(),
      /** @type {NsEventEmitter} */
      emitter = createNsEmitter(),
      asyncLocalStorage = new AsyncLocalStorage();

  // Set to when start() resolves
  let started = false;

  function createPromiseWithResolver() {
    let resolve, reject, promise;
    promise = new Promise((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return {promise, resolve, reject};
  }

  /**
   * @param {string[]} names
   * @return {Array<any>} an array of registered module implementations
   */
  function getInitializedModules(names) {
    return names.reduce((coll, n) => {
      const modInfo = modules.get(n);
      // @ts-ignore
      if(modInfo && modInfo.initialized) {
        // @ts-ignore
        coll.push(modInfo.module);
      }
      return coll;
    }, []);
  }


  /**
   * Traverses a module graph and find any circular dependencies
   * @param {string} vName 
   * @param {Traversal} ctx 
   * @throws {Error} If circular dependencies exist
   */
  function traverse(vName, ctx) {
    const {graph, visited, path, circular} = ctx,
      vertex = graph.v(vName);
    
    if(!vertex) {
      return ctx;
    }

    const {name, edges} = vertex;

    // Add the vertex to the visited set
    if(!visited.has(vertex)) {
      visited.add(vertex);
    }

    if(circular) {
      return ctx;
    }

    // Check if the vertex is already in the current path
    if(path.includes(name) && !circular) {
      // throw new Error(`Graph is cyclic ${[...path, name].join("->")}`);
      ctx.circular = [...path, name];
      return ctx;
    }

    path.push(name);
    for(const e of edges) {
      // const v = graph.v(e.to);
      traverse(e.to, ctx);
    }
    path.pop();
    return ctx;
  }

  /**
   * Checks whether the specified dependencies are available and calls the handler as soon as they
   * are available
   * @param {string[]} deps The depeneencies
   * @param {function(...*): void} handler The handler to call with dependencies
   */
  function resolveDeps(deps, handler) {
    const depMods = getInitializedModules(deps);
    if(depMods.length === deps.length) {
      handler(...depMods);
    }else {
      // Get the missing deps and add a once handlr to re-check and call the handler
      const missing = deps.filter(d => {
        const mod = modules.get(d);
        if(!mod) {
          throw new Error(`Module ${d} is not registered`);
        }
        // @ts-ignore
        return !mod.initialized;
      });
      missing.forEach(dep => {
        emitter.once(`module:${dep}`, () => {
          const depMods = getInitializedModules(deps);
          if(depMods.length === deps.length) {
            handler(...depMods);
          }
        });
      });
    }
  }

  /**
   * Initialize the module
   * @param {AppContext} context 
   * @param {ModuleInfo} modInfo 
   * @return {Promise<any>}
   */
  async function initializeModule(context, modInfo) {
    const {name, moduleDefn: {initialize}} = modInfo,
        moduleContext = createModuleContext(name, context);
    // console.info(`Initializing module ${name}`);
    const ret = Promise.resolve(initialize(moduleContext));

    return ret.then(module => {
      // console.info(`Initialized ${name}`);
      modInfo.module = module;
      // @ts-ignore
      modInfo.initialized = true;
      modules.set(name, modInfo);
      emitter.emit(`module:${name}`, module);
      emitter.emit("context:init-module", {name, module});
    }).catch(error => {
      // console.error(`Error initializing module ${name}`, error);
      throw error;
    });
  }


  /**
   * A module specific app context
   * @param {string} modName 
   * @param {AppContext} mainContext 
   * @returns {AppContext}
   */
  function createModuleContext(modName, mainContext) {
    const moduleName = modName;

    return new Proxy(mainContext, {
      get(target, prop, receiver) {
        switch(prop) {
          case "dependency": {
            return(name, handler) => {
              const depGraph = asyncLocalStorage.getStore(),
                  deps = Array.isArray(name) ? name : [name],
                  modInfo = modules.get(moduleName);

              // @ts-ignore This will never be undefined. See register()
              modInfo.dependencies = deps;
              // console.log(moduleName, deps);
              if(depGraph) {
                for(const dep of deps) {
                  if(!modules.has(dep)) {
                    throw new Error(`Module ${dep} is not registered`);
                  }
                  depGraph.addE(moduleName, dep);
                }
              }
              return mainContext.dependency(name, handler);
            };
          }
          case "start": {
            return () => {
              throw new Error("start() cannot be called from within modules");
            };
          }
          default: {
            return Reflect.get(target, prop, receiver);
          }
        }
      }
    });
  }

  /** @lends AppContext */
  return {
    register(moduleDefn) {
      const {name} = moduleDefn, 
          /** @type {ModuleInfo|undefined} */
          existing = modules.get(name);
      if(existing) {
        console.warn(`Module '${name}' was already registered, overwriting...`);
      }
      // @ts-ignore
      if(existing && existing.initialized) {
        console.warn(`Module ${name} already registered & initialized, owerwriting...`);
      }

      const modInfo = {
        name,
        moduleDefn,
        dependencies: [],
        initialized: false,
        module: null
      };
      modules.set(name, modInfo);
      if(started) {
        initializeModule(this, modInfo);
      }
      return this;
      // return Promise.resolve();
    },

    async start() {
      if(started) {
        return;
      }
      const modInfos = Array.from(modules.values()),
          {promise, resolve, reject} = createPromiseWithResolver(),
          unsub = emitter.on("context:init-module", (/* modInfo */) => {
            // @ts-ignore
            const initializedMods = modInfos.filter(m => m.initialized);
            if(initializedMods.length === modInfos.length) {
              unsub();
              emitter.emit("context:start");
              // @ts-ignore
              resolve();
              // console.debug(Array.from(modules.values()));
            }
          });

      depGraph.addV("[root]");
      asyncLocalStorage.run(depGraph, () => {
        // console.log("Running in async local storage");
        let chain = Promise.resolve();
        // @ts-ignore
        for(const modInfo of modInfos) {
          depGraph.addV(modInfo.name);
          depGraph.addE("[root]", modInfo.name);
          chain.then(() => initializeModule(this, modInfo));
        }
        chain.then(() => {
          // const result = depGraph.checkDeps("[root]");
          /** @type {Traversal} */
          const traversal = traverse("[root]", {
            graph: depGraph,
            circular: null,
            path: [],
            visited: new Set()
          });

          if(traversal.circular) {
            throw new Error(`Circular dependency detected. ${traversal.circular.join("->")}`);
          }
        })
        .catch(err => {
          // @ts-ignore
          reject(err);
          // console.error(err);
        });
      });
      return promise;
    },

    getModule(name) {
      const modInfo = modules.get(name);
      return modInfo ? modInfo.module : null;
    },

    dependency(name, handler) {
      /** @type {string[]} */
      // @ts-ignore
      let deps = name;
      if(!Array.isArray(name)) {
        deps = [name];
      }
      if(typeof handler === "function") {
        resolveDeps(deps, handler);
      }else {
        return new Promise((resolve, reject) => {
          resolveDeps(deps, (...dependencies) => {
            resolve(dependencies);
          });
        });
      }
    },
    
    on(event, handler) {
      return emitter.on(event, handler);
    },
    once(event, handler) {
      return emitter.once(event, handler);
    },
    emit(event, ...args) {
      emitter.emit(event, ...args);
    }
  };
}

module.exports = createAppContext;

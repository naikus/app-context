/* global Map */

/**
 * @typedef {import("../types").ModuleDefn} ModuleDefn
 * @typedef {import("../types").AppContext} AppContext
 * @typedef {import("./namespaced-emitter").NsEventEmitter} NsEventEmitter;
 * @typedef {import("./namespaced-emitter").NsEventListener} NsEventListener;
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
   * @type {Map<string, ModuleDefn>}
   */
  const modules = new Map(),
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
      const mod = modules.get(n);
      // @ts-ignore
      if(mod && mod.initialized) {
        // @ts-ignore
        coll.push(mod.module);
      }
      return coll;
    }, []);
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
   * @param {ModuleDefn} moduleDefn 
   * @return {Promise<any>}
   */
  async function initializeModule(context, moduleDefn) {
    const {name, initialize} = moduleDefn,
        moduleContext = createModuleContext(name, context);
    // console.info(`Initializing module ${name}`);
    const ret = Promise.resolve(initialize(moduleContext));

    return ret.then(module => {
      // console.info(`Initialized ${name}`);
      moduleDefn.module = module;
      // @ts-ignore
      moduleDefn.initialized = true;
      modules.set(name, moduleDefn);
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

    return {
      register(moduleDefn) {
        return mainContext.register(moduleDefn)
      },
      start() {
        throw new Error("Not allowed");
      },
      getModule(name) {
        return mainContext.getModule(name);
      },
      dependency(name, handler) {
        const depGraph = asyncLocalStorage.getStore(),
            deps = Array.isArray(name) ? name : [name];

        // console.log(moduleName, deps);
        if(depGraph) {
          for(const dep of deps) {
            if(!modules.has(dep)) {
              throw new Error(`Module ${dep} is not registered`);
            }
            depGraph.addE(moduleName, dep);
          }
        }
        return mainContext.dependency(name);
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

  /** @lends AppContext */
  return {
    async register(moduleDefn) {
      const {name} = moduleDefn, 
          /** @type {ModuleDefn|undefined} */
          existing = this.getModule(name);
      if(existing) {
        console.warn(`Module '${name}' was already registered, overwriting...`);
      }
      // @ts-ignore
      if(existing && existing.initialized) {
        console.warn(`Module ${name} already registered & initialized, owerwriting...`);
      }

      modules.set(name, moduleDefn);
      if(started) {
        return await initializeModule(this, moduleDefn);
      }
      return Promise.resolve();
    },

    async start() {
      if(started) {
        return;
      }
      const mods = Array.from(modules.values()),
          depGraph = createGraph(),
          {promise, resolve, reject} = createPromiseWithResolver(),
          unsub = emitter.on("context:init-module", (/* modInfo */) => {
            // @ts-ignore
            const initializedMods = mods.filter(m => m.initialized);
            if(initializedMods.length === mods.length) {
              unsub();
              emitter.emit("context:start");
              // @ts-ignore
              resolve();
            }
          });

      depGraph.addV(":root:");
      asyncLocalStorage.run(depGraph, () => {
        // console.log("Running in async local storage");
        let chain = Promise.resolve();
        // @ts-ignore
        for(const mod of mods) {
          depGraph.addV(mod.name);
          depGraph.addE(":root:", mod.name);
          chain.then(() => initializeModule(this, mod));
        }
        chain.then(() => {
          depGraph.checkDeps(":root:");
        })
        .catch(err => {
          // @ts-ignore
          reject(err);
          console.error(err);
        });
      });
      return promise;
    },

    getModule(name) {
      const defn = modules.get(name);
      return defn ? defn.module : null;
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

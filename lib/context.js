/* global Map */

/**
 * @typedef {import("../types").ModuleDefn} ModuleDefn
 * @typedef {import("../types").AppContext} AppContext
 * @typedef {import("./namespaced-emitter").NsEventEmitter} NsEventEmitter;
 * @typedef {import("./namespaced-emitter").NsEventListener} NsEventListener;
 */


const createNsEmitter = require("./namespaced-emitter");

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
      emitter = createNsEmitter();

  /**
   * @param {string[]} names
   * @return {Array<any>} an array of registered module implementations
   */
  function getRegisteredModules(names) {
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
    const depMods = getRegisteredModules(deps);
    // console.log(deps, depMods);
    if(depMods.length === deps.length) {
      handler(...depMods);
    }else {
      // Get the missing deps and add a once handlr to re-check and call the handler
      const missing = deps.filter(d => !modules.get(d));
      missing.forEach(dep => {
        emitter.once(`module:${dep}`, () => {
          const depMods = getRegisteredModules(deps);
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
    const {name, initialize} = moduleDefn;
    // console.info(`Initializing module ${name}`);
    const ret = Promise.resolve(initialize(context));

    return ret.then(module => {
      // console.info(`Initialized ${name}`);
      moduleDefn.module = module;
      // @ts-ignore
      moduleDefn.initialized = true;
      modules.set(name, moduleDefn);
      emitter.emit("context:init-module", {name, module});
      emitter.emit(`module:${name}`, module);
    }).catch(error => {
      // console.error(`Error initializing module ${name}`, error);
      throw error;
    });
  }

  /** @lends AppContext */
  return {
    async register(moduleDefn) {
      const {name} = moduleDefn, existing = this.getModule(name);
      if(existing) {
        console.warn(`Module '${name}' was already registered, overwriting...`);
      }
      return initializeModule(this, moduleDefn);
      /*
      const defs = Array.isArray(moduleDefns) ? moduleDefns : [moduleDefns];
      defs.forEach(def => {
        initializeModule(this, def);
      });
      */
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

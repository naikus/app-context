
/* global Map */
const createNsEmitter = require("./namespaced-emitter"),
    /**
     * @namesapce ApplicationContext
     */

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
     * @return {ApplicationContext} The application context that is passed to each module's initialization
     * function
     */
    createAppContext = () => {
      const modules = new Map(),
          emitter = createNsEmitter(),
          getRegisteredModules = names => {
            return names.reduce((coll, n) => {
              const mod = modules.get(n);
              if(mod && mod.initialized) {
                coll.push(mod.module);
              }
              return coll;
            }, []);
          },
          /**
           * Checks whether the specified dependencies are available and calls the handler as soon as they
           * are available
           * @param {Array} deps The depeneencies
           * @param {Function} handler The handler to call with dependencies
           */
          resolveDeps = (deps, handler) => {
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
          },

          initializeModule = (context, moduleDefn) => {
            const {name, initialize} = moduleDefn;
            // console.info(`Initializing module ${name}`);
            const ret = Promise.resolve(initialize(context));

            return ret.then(module => {
              // console.info(`Initialized ${name}`);
              moduleDefn.module = module;
              moduleDefn.initialized = true;
              modules.set(name, moduleDefn);
              emitter.emit("module:init", {name, module});
              emitter.emit(`module:${name}`, module);
            }).catch(error => {
              // console.error(`Error initializing module ${name}`, error);
              throw error;
            });
          };

      /** @lends ApplicationContext */
      return {
        /**
         * Register a module with the application context. Module defination has a name and initialize(context)
         * async function (Returns a promise) The promise can resolve to any object or service.
         * @memberof ApplicationContext#
         * @param {Object} moduleDefn The module definition with following structure
         * @example
         * <code>
         *  {
         *    name: "my-module" // A unique name
         *    async initialize(ctx) {}
         *  }
         * </code>
         */
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
        /**
         * Gets a module by name or null if the module does not exist
         * @memberof ApplicationContext#
         * @param {String} name The module name with which it was registered
         * @return {Object} The module or null of module was not found
         */
        getModule(name) {
          const defn = modules.get(name);
          return defn ? defn.module : null;
        },
        /**
         * Register to be nodified when a dependent module was registered and initialized
         * @memberof ApplicationContext#
         * @param {String|[String]} name A string or an arry of string module names
         * @param {Function} handler The handler to be called when all the dependencies are satisfied.
         * The handler is called with the dependencies as arguments in the order they were specified in
         * the first argument
         * @return {Promise} only if handler is not specifed which resolves to all the dependencies
         * @example
         * <code>
         *  context.dependency(["foo", "bar"], (foo, bar) => {
         *    // do something with foo and bar
         *  });
         * </code>
         */
        dependency(name, handler) {
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
        /**
         * Event emitter semantics
         * @memberof ApplicationContext#
         * @see #once
         * @param {String} event The event name
         * @param {Function} handler The handler to call
         * @return {Function} The unsubscribe function
         */
        on(event, handler) {
          return emitter.on(event, handler);
        },
        once(event, handler) {
          return emitter.once(event, handler);
        }
      };
    };

module.exports = createAppContext;

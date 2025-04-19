import {NsEventListener, NsEventEmitter, EventListener} from "./lib/namespaced-emitter";


export interface ModuleDefn extends Object {
  /**
   * The name of the application module
   */
  name: string;

  /**
   * Initialize this module and return the actual module.
   * This module can by any object, value, service, function, etc.
   * @param {AppContext} context The application context
   */
  async initialize(context: AppContext): Promise<any> | any;

  [key: string]: any;
}


/**
 * Application context provides access to other modules installed as part of the application. It provides
 * API to register modules a rudimentary dependency management for modules that depend on other modules
 * Usage
 * @example
 * <code>
 * const context = createAppContext();
 * context.registerModule({
 *  name: "mymodule",
 *  async initialize(ctx) {
 *    const [a, b] = await ctx.dependency(["a", "b"]);
 *    const service = await createMyService(a, b);
 *    return service;
 *  }
 * })
 * </code>
 *
 */
export interface AppContext extends Object {
  /**
   * Register a module with the application context. Module defination has a name and initialize(context)
   * async function (Returns a promise) The promise can resolve to any object or service.
   * @param {ModuleDefn} moduleDefn The module definition with following structure
   * @example
   * <code>
   *  const defn = {
   *    name: "my-module" // A unique name
   *    async initialize(ctx) {}
   *  }
   * 
   *  context.register(defn)
   * </code>
   */
  register(module: ModuleDefn): AppContext;

  /**
   * Gets a module by name or null if the module does not exist
   * @param {String} name The module name with which it was registered
   * @return {any} The module or null of module was not found
   */
  getModule(name: string): any;

  /**
   * Register to be nodified when a dependent module was registered and initialized
   * @param {String|[String]} name A string or an arry of string module names
   * @param {Function} handler The handler to be called when all the dependencies are satisfied.
   * The handler is called with the dependencies as arguments in the order they were specified in
   * the first argument
   * @return {Promise<Array>} only if handler is not specifed which resolves to all the dependencies
   * @example
   * <code>
   *  context.dependency(["foo", "bar"], (foo, bar) => {
   *    // do something with foo and bar
   *  });
   *  // OR
   *  const [foo, bar] = await context.dependency(["foo", "bar"]);
   * </code>
   */
  dependency(name: string|Array<string>, handler?: function(...*)): Promise<Array> | void;

  /**
   * Start the application context. This will initialize all the modules in the order they were registered
   * and call the initialize function of each module.
   * @return {Promise} A promise that resolves when all the modules are initialized
   */
  async start(): Promise<void>;

  /**
   * Register for a context event
   * @see #once
   * @param {String} event The event name.
   * @param {Function} handler The handler to call
   * @return {Function} The unsubscribe function
   */
  on(event: string, handler: NsEventListener|EventListener): Function;

  /**
   * Register for a context event to be called only once
   * @param {string} event The event name e.g. module:init or module:
   * @param handler The event handler
   * @return {Function} The unsubscribe function
   */
  once(event: string, handler: NsEventListener|EventListener ): Function;

  emit(event: string, ...args: any[]): void;
}
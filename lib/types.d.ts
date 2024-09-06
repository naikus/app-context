
export interface ModuleDefn<T> {
  /**
   * The name of the application module
   */
  name: string;


  /**
   * The module impmentation
   */
  module: ?T;

  /**
   * Initialize this module and return the actual module.
   * This module can by any object, value, service, function, etc.
   * @param {AppContext} context The application context
   */
  async initialize(context: AppContext): Promise<T>;
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
export interface AppContext {
  /**
   * Register a module with the application context. Module defination has a name and initialize(context)
   * async function (Returns a promise) The promise can resolve to any object or service.
   * @memberof ApplicationContext#
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
  async register(module: ModuleDefn): Promise<ModuleDefn>;

  /**
   * Gets a module by name or null if the module does not exist
   * @memberof ApplicationContext#
   * @param {String} name The module name with which it was registered
   * @return {any} The module or null of module was not found
   */
  getModule(name: string): any;

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
   *  // OR
   *  const [foo, bar] = await context.dependency(["foo", "bar"]);
   * </code>
   */
  dependency(name: string|[string], handler?): Promise<any|[any]> | void;
}
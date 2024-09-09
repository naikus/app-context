/**
 * @typedef {import("./types").AppContext} AppContext
 * @typedef {import("./lib/namespaced-emitter").NsEventEmitter} NsEventEmitter;
 */

const createAppContext = require("./lib/context"),
    createNsEmitter = require("./lib/namespaced-emitter");

module.exports = {
  /**
   * @function
   * @return {AppContext}
   */
  create: createAppContext,

  /**
   * @function
   * @return {NsEventEmitter}
   */
  createNsEmitter
};

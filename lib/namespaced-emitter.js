/* global Map */

/**
 * @template {string} namespace A event namespace string, always ends with a separator e.g. ":", "/", etc
 */

/**
 * A namespace event listener
 * @callback NsEventListener
 * @param {string} event The event name
 * @param {...*} args The event arguments
 * @example
 * const emitter = nsEmitter(":");
 * emitter.on("foo:", (event, data) => {
 *  console.log(event, data);
 * }
 * emitter.emit("foo:bar", "baz");
 * // will log 'bar', 'baz'
 */

/**
 * @callback EventListener
 * @param {...*} args The event data
 */

/**
 * @typedef {Object} NsEventEmitter
 * @property {function(string|namespace, EventListener | NsEventListener): function} on - Subscribe to an event or a namespace
 * @property {function(string, EventListener): function} on - Subscribe to an event or a namespace
 * @property {function(string|namespace, EventListener | NsEventListener): function} once - Subscribe to an event or a namespace once
 * @property {function(string|namespace, ...*): void} emit - Emit an event or a namespace 
 * @property {function} close - Close the event emitter and remove all listeners
 */

const EventEmitter = require("events");

/**
 * A namespaced event emitter wrapper. This emitter provides 'on' 'off' and 'once' semantics
 * for events. The on and off return event un-subscriber functions that can be called to
 * unsubscibe from events.
 * Event handlers can subscribe to all events in a namesapce or individual events. e.g.
 * <code>
 *  const emitter = nsEmitter(":")
 *  emitter.on("foo:", (event, data) => {
 *    console.log(event, data);
 *  });
 *  emitter.emit("foo:bar", "baz");
 *  // will log 'bar', 'baz'
 *
 *  emitter.on("bar:baz", data => {
 *    console.log(data);
 *  });
 *  emitter.emit("bar:baz", "foo");
 *  // will log "foo"
 * </code>
 * @param {string} separator The seperator for namespace. Default is ':' if not provided
 * @return {NsEventEmitter} The event emitter
 */
module.exports = (separator = ":") => {
  /** @type Map<String, EventEmitter> */
  const emitters = new Map();

  /**
   * @param {string} namespace
   * @return {EventEmitter}
   */
  function getOrCreateEmitter(namespace)  {
    let emitter = emitters.get(namespace);
    if(!emitter) {
      emitter = new EventEmitter();
      emitters.set(namespace, emitter);
    }
    return emitter;
  }

  /**
   * @param {string} event 
   * @returns {EventEmitter}
   */
  function getEmitter(event)  {
    let emitter;
    if(isNs(event)) {
      emitter = getOrCreateEmitter(event.substring(0, event.length - 1));
    }else {
      emitter = emitters.get("");
    }
    // @ts-ignore
    return emitter;
  }

  /**
   * @param {string} event 
   * @returns {boolean}
   */
  function isNs(event) {
    return event.endsWith(separator);
  }

  /**
   * Gets an array containing the event info
   * @param {string} event 
   * @returns {string[]} A string array of length of atleast 2 containing the ns and event name
   */
  function eventInfo(event) {
    return event.indexOf(separator) === -1 ? ["", event] : event.split(separator);
  }

  emitters.set("", new EventEmitter());

  /**
   * @type {NsEventEmitter}
   */
  return {
    /**
     * Register for a specific event or a for all events from a namespace. e.g.
     * <code>
     *  // This handler is called for both 'init' and 'start' events.
     *  emitter.on("system:", (event, data) => {}})
     *  emitter.emit("system:init", {state: true});
     *  emitter.emit("system:start", {state: true});
     * </code>
     * @param {String} event The event name (namespaced or otherwise) or napespace name
     * @param {EventListener|NsEventListener} handler The handler to call, its called with event name and data as parameters
     * @return {Function} The unsubscribe function
     */
    on(event, handler) {
      const emitter = getEmitter(event);
      emitter.on(event, handler);
      return () => emitter.off(event, handler);
    },

    /**
     * This is same as {@link NsEventEmitter#on} but will only fire once
     * @param {string} event 
     * @param {EventListener | NsEventEmitter} handler 
     * @returns {Function} The unsubscribe function
     */
    once(event, handler) {
      const emitter = getEmitter(event);
      // @ts-ignore
      emitter.once(event, handler);
      // @ts-ignore
      return () => emitter.off(event, handler);
    },
    emit(event, ...args) {
      const evInfo = eventInfo(event),
          [ns, ...evt] = evInfo,
          defaultEmitter = emitters.get("");
      let emitter;
      if(ns) {
        emitter = getOrCreateEmitter(ns);
        emitter.emit(`${ns}:`, evt.join(separator), ...args);
      }
      // @ts-ignore
      defaultEmitter.emit(event, ...args);
    },
    close() {
      emitters.forEach((emitter, ns) => {
        if(!ns) {
          // default listener
          emitter.eventNames().forEach(e => {
            emitter.removeAllListeners(e);
          });
        }else {
          emitter.removeAllListeners(ns);
        }
      });
    }
  };
};

/* global Map */
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
 * @param {String} separator The seperator for namespace. Default is ':' if not provided
 * @return {Object} The event emitter
 */
module.exports = (separator = ":") => {
  const emitters = new Map(),
      getOrCreateEmitter = namespace => {
        let emitter = emitters.get(namespace);
        if(!emitter) {
          emitter = new EventEmitter();
          emitters.set(namespace, emitter);
        }
        return emitter;
      },
      getEmitter = event => {
        let emitter;
        if(isNs(event)) {
          emitter = getOrCreateEmitter(event.substring(0, event.length - 1));
        }else {
          emitter = emitters.get("");
        }
        return emitter;
      },
      isNs = event => {
        return event.endsWith(separator);
      },
      eventInfo = event => {
        return event.indexOf(separator) === -1 ? ["", event] : event.split(separator);
      };

  emitters.set("", new EventEmitter());

  return {
    /**
     * Register for a specific event or a for all events from a namespace. e.g.
     * <code>
     *  // This handler is called for both 'init' and 'start' events.
     *  emitter.on("system:", (ns, event, data) => {}})
     *  emitter.emit("system:init", {state: true});
     *  emitter.emit("system:start", {state: true});
     * </code>
     * @param {String} event The event name (namespaced or otherwise) or napespace name
     * @param {Function} handler The handler to call, its called with event name and data as parameters
     * @return {Function} The unsubscribe function
     */
    on(event, handler) {
      const emitter = getEmitter(event);
      emitter.on(event, handler);
      return () => emitter.off(event, handler);
    },
    once(event, handler) {
      const emitter = getEmitter(event);
      emitter.once(event, handler);
      return () => emitter.off(event, handler);
    },
    emit(event, ...args) {
      const evInfo = eventInfo(event),
          [ns, evt] = evInfo,
          defaultEmitter = emitters.get("");
      let emitter;
      if(ns) {
        emitter = getOrCreateEmitter(ns);
        emitter.emit(`${ns}:`, evt, ...args);
      }
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

const createAppContext = require("./lib/context"),
    createNsEmitter = require("./lib/namespaced-emitter");

module.exports = {
  create: createAppContext,
  createNsEmitter
};

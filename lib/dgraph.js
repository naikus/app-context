/**
 * @typedef {Object} V
 * @property {string} name 
 * @property {Array<E>} edges
 * @property {any} data
 */

/**
 * @typedef {Object} E
 * @property {string} name
 * @property {string} from
 * @property {string} to
 */

/**
 * @typedef {Object} Ctx
 * @property {Set<V>} visited
 * @property {Array<string>} path
 */

/**
 * @template T
 * @typedef {Object} DGraph
 * @property {Iterable<V>} vertices
 * @property {(name: string) => V} v
 * @property {(name: string, data?: T) => void} addV
 * @property {(from: string, to: string) => void} addE
 * @property {(name: string) => Array<string>} checkDeps
 */

/**
 * @template T
 * @returns {DGraph<T>}
 */
function dGraph() {
  /**
   * @param {string} name 
   * @param {T} data 
   * @returns {V}
   */
  function createVertex(name, data) {
    return {
      get name() {return name;},
      edges: [],
      data
    };
  }

  /**
   * @param {string} sv 
   * @param {string} tv 
   * @returns {E}
   */
  function createEdge(sv, tv) {
    return {
      get name() {
        return `${sv}->${tv}`;
      },
      from: sv, to: tv
    };
  }

  /**
   * @param {V} v 
   * @param {E} edge 
   * @returns {boolean}
   */
  function containsEdge(v, edge) {
    return v.edges.some(e => e.name === edge.name);
  }

  /**
   * @param {V} vertex 
   * @param {Ctx} ctx 
   */
  function walk(vertex, ctx = {visited: new Set(), path: []}) {
    const edges = vertex.edges,
        {visited, path} = ctx;

    if(visited.has(vertex)) {
      throw new Error(`Circular dependency detected. ${path.join("->")}->${vertex.name}`);
    }

    if(!path.includes(vertex.name)) {
      path.push(vertex.name);
    }
    for(const e of edges) {
      visited.add(vertex);
      const v = vertices.get(e.to);
      v && walk(v, ctx);
      visited.delete(vertex);
    }
    return ctx
  }

  const vertices = new Map();

  /** @type DGraph<T> */
  return {
    get vertices() {
      return vertices.values();
    },

    /**
     * @param {string} name 
     * @returns {V}
     */
    v(name) {
      return vertices.get(name);
    },

    /**
     * @param {string} v
     * @param {any} data
     */
    addV(v, data = null) {
      vertices.set(v, createVertex(v, data));
    },

    /**
     * @param {string} s
     * @param {string} t 
     */
    addE(s, t) {
      const sv = vertices.get(s);
      if(!sv) {
        throw new Error(`Vertex ${s} not found`);
      }
      const tv = vertices.get(t);
      if(!tv) {
        throw new Error(`Vertex ${t} not found`);
      }
      const edge = createEdge(s, t);
      if(!containsEdge(sv, edge)) {
        sv.edges.push(edge);
      }
    },

    /**
     * @param {string} v 
     */
    checkDeps(v) {
      const vertex = vertices.get(v);
      if(!vertex) { 
        throw new Error(`Vertex ${v} not found`);
      }
      const ctx = walk(vertex);
      return ctx.path;
    }
  };
}

module.exports = dGraph;
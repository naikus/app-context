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
 * @template T
 * @typedef {Object} DGraph
 * @property {Iterable<V>} vertices
 * @property {(name: string) => V} v
 * @property {(name: string, data?: T) => V} addV
 * @property {(from: string, to: string) => void} addE
 */

/**
 * @template T
 * @param {...[string, T]} v
 * @returns {DGraph<T>}
 */
function dGraph(...v) {
  /**
   * @param {string} name 
   * @param {T?} data 
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

  const vertices = new Map();

  /** @type DGraph<T> */
  const graph = {
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
     * @param {T?} data
     * @returns {V} The newly created vertex
     */
    addV(v, data = null) {
      const vtx = createVertex(v, data);
      vertices.set(v, vtx);
      return vtx;
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
    }
  };

  for(const [name, data] of v) {
    graph.addV(name, data);
  }

  return graph;
}

module.exports = dGraph;
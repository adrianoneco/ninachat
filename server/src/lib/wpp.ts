export class Wpp {
  private static manager: any = null;

  // Called by WppManagerService to register itself
  static registerManager(mgr: any) {
    this.manager = mgr;
  }

  // Return the raw Map of instances (session -> client)
  static getInstanceMap(): Map<string, any> {
    if (!this.manager) return new Map();
    return this.manager.instances || new Map();
  }

  // Return an array of client objects
  static getInstances(): any[] {
    const map = this.getInstanceMap();
    return Array.from(map.values());
  }

  // Return a list of sessions (keys)
  static getSessions(): string[] {
    const map = this.getInstanceMap();
    return Array.from(map.keys());
  }

  // Return a mapping session -> client (plain object)
  static getInstancesRecord(): Record<string, any> {
    const r: Record<string, any> = {};
    for (const [k, v] of this.getInstanceMap()) {
      r[k] = v;
    }
    return r;
  }

  // Optional helper: get client by session or id
  static getClient(sessionOrId: string): any | undefined {
    const map = this.getInstanceMap();
    return map.get(sessionOrId);
  }
}

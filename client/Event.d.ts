type Callback<T = any> = (payload: T) => void;
declare function subscribe<T = any>(type: string, callback: Callback<T>): () => void;
declare function publish<T = any>(type: string, payload: T): void;
export { subscribe, publish };

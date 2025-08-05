interface InitOptions {
    host: string;
    port: number;
    protocol: string;
}
type Callback<T = any> = (payload: T) => void;
declare const nodeEvent: {
    init({ host, port, protocol }: InitOptions): void;
    subscribe<T = any>(type: string, callback: Callback<T>): () => void;
    publish<T = any>(...args: [...string[], T]): void;
};
export { nodeEvent };

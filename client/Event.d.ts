interface InitOptions {
    host: string;
    port: number;
    protocol?: 'http' | 'https';
}
type Callback<T = any> = (payload: T) => void;
declare const nodeEvent: {
    init({ host, port, protocol }: InitOptions): void;
    subscribe<T = any>(type: string, callback: Callback<T>): () => void;
    publish<T = any>(type: string, payload: T): void;
};
export { nodeEvent };

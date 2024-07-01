export declare function addTask<T>(task: PromiseLike<T>): PromiseLike<T>;
export declare function run<T>(codeToRun: () => T, completionCallback: (error: any) => void): T;
export declare function baseUrl(url?: string): string;

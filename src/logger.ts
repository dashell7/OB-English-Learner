export class Logger {
    static log(...args: any[]) {
        console.log(...args);
    }
    static error(...args: any[]) {
        console.error(...args);
    }
    static warn(...args: any[]) {
        console.warn(...args);
    }
}

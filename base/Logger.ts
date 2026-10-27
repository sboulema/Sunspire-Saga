import {GoldenSun} from "GoldenSun";

export enum msg_types {
    INFO = "info",
    WARNING = "warning",
    ERROR = "error",
}

/**
 * This class is responsible to log messages mainly in case of
 * user bad input. If you're running desktop app, it will create
 * a log file inside logs directory.
 */
export class Logger {
    private static readonly MESSAGE_NUMBER_LIMIT = 15;

    private data: GoldenSun;
    private msgs_count: {[msg: string]: number};

    constructor(data: GoldenSun) {
        this.data = data;
        this.msgs_count = {};
        this.log_message("Engine started.", msg_types.INFO);
    }

    log_message(message: string, type: msg_types = msg_types.WARNING) {
        if (!message) {
            return;
        }
        const now = new Date().toLocaleString();
        if (message in this.msgs_count) {
            ++this.msgs_count[message];
            if (this.msgs_count[message] === Logger.MESSAGE_NUMBER_LIMIT) {
                message = `Sunspire - [${now}] [WARNING]: limit for '${message}' message reached.`;
                console.warn(message);
                return;
            } else if (this.msgs_count[message] > Logger.MESSAGE_NUMBER_LIMIT) {
                return;
            }
        } else {
            this.msgs_count[message] = 0;
        }
        switch (type) {
            case msg_types.INFO:
                message = `Sunspire - [${now}] [INFO]: ${message}`;
                console.log(message);
                break;
            case msg_types.WARNING:
                message = `Sunspire - [${now}] [WARNING]: ${message}`;
                console.warn(message);
                break;
            case msg_types.ERROR:
                message = `Sunspire - [${now}] [ERROR]: ${message}`;
                console.error(message);
                break;
            default:
                return;
        }
    }
}

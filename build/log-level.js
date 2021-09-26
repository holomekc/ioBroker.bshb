"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogLevel = void 0;
/**
 * This enum defines all log levels with an ordinal ordered by lower is finer log level.
 * This helps to decide if a log should be present
 *
 * @author Christopher Holomek
 * @since 01.12.2019
 */
var LogLevel;
(function (LogLevel) {
    LogLevel[LogLevel["silly"] = 0] = "silly";
    LogLevel[LogLevel["debug"] = 1] = "debug";
    LogLevel[LogLevel["info"] = 2] = "info";
    LogLevel[LogLevel["warn"] = 3] = "warn";
    LogLevel[LogLevel["error"] = 4] = "error";
})(LogLevel = exports.LogLevel || (exports.LogLevel = {}));
//# sourceMappingURL=log-level.js.map
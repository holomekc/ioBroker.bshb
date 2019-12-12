/**
 * This enum defines all log levels with an ordinal ordered by lower is finer log level.
 * This helps to decide if a log should be present
 *
 * @author Christopher Holomek
 * @since 01.12.2019
 */
export enum LogLevel {
    silly,
    debug,
    info,
    warn,
    error
}
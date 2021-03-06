import {ILoggerConfig} from './types';
import pino from 'pino';

export const getLoggerFromConfig = <T extends ILoggerConfig>(config?: T) => {
    const loggerOptions = config && config.logOptions ? config.logOptions : {};
    return config && config.logger ? config.logger : pino(loggerOptions);
};

const fs = require('fs');
const path = require('path');
const config = require('../config/config');

class LoggerService {
  constructor() {
    this.logLevel = config.logging.level;
    this.levels = { error: 0, warn: 1, info: 2, debug: 3 };
    
    if (config.logging.enableFileLogging) {
      this.logDir = path.join(__dirname, '../../logs');
      if (!fs.existsSync(this.logDir)) {
        fs.mkdirSync(this.logDir, { recursive: true });
      }
    }
  }

  _shouldLog(level) {
    return this.levels[level] <= this.levels[this.logLevel];
  }

  _formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `[${timestamp}] [${level.toUpperCase()}] ${message} ${metaStr}`;
  }

  _writeToFile(formattedMessage) {
    if (config.logging.enableFileLogging) {
      const logFile = path.join(this.logDir, `app-${new Date().toISOString().split('T')[0]}.log`);
      fs.appendFileSync(logFile, formattedMessage + '\n');
    }
  }

  error(message, meta = {}) {
    if (this._shouldLog('error')) {
      const formatted = this._formatMessage('error', message, meta);
      console.error('\x1b[31m%s\x1b[0m', formatted);
      this._writeToFile(formatted);
    }
  }

  warn(message, meta = {}) {
    if (this._shouldLog('warn')) {
      const formatted = this._formatMessage('warn', message, meta);
      console.warn('\x1b[33m%s\x1b[0m', formatted);
      this._writeToFile(formatted);
    }
  }

  info(message, meta = {}) {
    if (this._shouldLog('info')) {
      const formatted = this._formatMessage('info', message, meta);
      console.log('\x1b[36m%s\x1b[0m', formatted);
      this._writeToFile(formatted);
    }
  }

  debug(message, meta = {}) {
    if (this._shouldLog('debug')) {
      const formatted = this._formatMessage('debug', message, meta);
      console.log('\x1b[90m%s\x1b[0m', formatted);
      this._writeToFile(formatted);
    }
  }
}

module.exports = new LoggerService();


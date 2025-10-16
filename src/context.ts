import * as log from '@std/log'

export interface Config {
  log_level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR'
  personal_finances_folder: string
}

export class Context {
  log: log.Logger

  constructor(public config: Config) {

    log.setup({
      handlers: {
        default: new log.ConsoleHandler(config.log_level, {
          useColors: true
        })
      }
    })
    this.log = log.getLogger()
  }
}

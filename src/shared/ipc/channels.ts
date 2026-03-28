export const IPC_CHANNELS = {
  regionStart: 'region:start',
  regionConfirm: 'region:confirm',
  regionCancel: 'region:cancel',
  regionSelected: 'region:selected',

  scanTrigger: 'scan:trigger',
  scanResult: 'scan:result',
  scanError: 'scan:error',

  settingsGetGridSize: 'settings:getGridSize',
  settingsSetGridSize: 'settings:setGridSize',

  dictionaryList: 'dictionary:list',
  dictionarySet: 'dictionary:set',

  gridSolve: 'grid:solve',

  mainClose: 'main:close',
  mainSetAlwaysOnTop: 'main:setAlwaysOnTop',
  mainGetAlwaysOnTop: 'main:getAlwaysOnTop'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]

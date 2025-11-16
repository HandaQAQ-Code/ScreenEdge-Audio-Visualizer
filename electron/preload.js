import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('electronAPI', {
  getDesktopSources: (options = {}) => ipcRenderer.invoke('get-desktop-sources', options),
  closeSettingWindow: () => ipcRenderer.send('close-setting-window'),
})

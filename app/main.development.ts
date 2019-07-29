import {app, BrowserWindow, Menu, globalShortcut, systemPreferences} from 'electron';
import windowStateKeeper from 'electron-window-state';
import fs from 'graceful-fs';
import log from './log';

const userData = app.getPath('userData');
const dirSep = process.platform === 'win32' ? '\\' : '/';
const mediaDir = `${userData}${dirSep}media`;
const chromiumFeatures = 'CheckerImaging,'
  + 'VizHitTestDrawQuad,'
  + 'BlinkGenPropertyTrees,'
  + 'BlinkHeapUnifiedGarbageCollection,'
  + 'V8Orinoco,'
  + 'ExpensiveBackgroundTimerThrottling,'
  + 'FontCacheScaling,'
  + 'WebContentsOcclusion,'
  + 'CalculateNativeWinOcclusion';

if (!fs.existsSync(mediaDir)) {
  try {
    fs.mkdirSync(mediaDir);
  } catch (e) {
    log.error(`Could not create media folder on first time start up: ${e}`);
  }
}

let mainWindow: BrowserWindow;
if (process.env.NODE_ENV === 'production') {
  const sourceMapSupport = require('source-map-support'); // eslint-disable-line
  sourceMapSupport.install();
}

if (process.env.NODE_ENV === 'development') {
  require('electron-debug')(); // eslint-disable-line global-require
  const path = require('path'); // eslint-disable-line
  const p = path.join(__dirname, '..', 'app', 'node_modules'); // eslint-disable-line
  require('module').globalPaths.push(p); // eslint-disable-line
}

app.commandLine.appendSwitch('enable-usermedia-screen-capturing');
app.commandLine.appendSwitch('enable-native-gpu-memory-buffers');
app.commandLine.appendSwitch('enable-gpu-rasterization');
app.commandLine.appendSwitch('num-raster-threads', '4');
app.commandLine.appendSwitch('gpu-rasterization-msaa-sample-count', '0');
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-hardware-overlays', 'single-fullscreen');
app.commandLine.appendSwitch('disable-smooth-scrolling');
app.commandLine.appendSwitch('use-angle', 'gl');
app.commandLine.appendSwitch('default-background-color', '000000');
app.commandLine.appendSwitch('js-flags', '--max_old_space_size=32768,--nolazy');
app.commandLine.appendSwitch('enable-features', chromiumFeatures);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

const installExtensions = async (): Promise<any> => {
  if (process.env.NODE_ENV === 'development') {
    const installer = require('electron-devtools-installer'); // eslint-disable-line global-require

    const extensions = [
      'REACT_DEVELOPER_TOOLS'
    ];

    const forceDownload = !!process.env.UPGRADE_EXTENSIONS;

    // TODO: Use async interation statement.
    //       Waiting on https://github.com/tc39/proposal-async-iteration
    //       Promises will fail silently, which isn't what we want in development
    return Promise
      .all(extensions.map(name => installer.default(installer[name], forceDownload)))
      .catch(console.log);
  }
};

app.on('ready', async (): Promise<any> => {
  await installExtensions();

  let mainWindowState = windowStateKeeper({
    defaultWidth: 1421,
    defaultHeight: 1040
  });

  let aeroEnabled = process.platform === 'win32' ? systemPreferences.isAeroGlassEnabled() : true;

  mainWindow = new BrowserWindow({
    show: false,
    x: mainWindowState.x,
    y: mainWindowState.y,
    width: mainWindowState.width,
    height: mainWindowState.height,
    minWidth: 1421,
    minHeight: 1040,
    frame: !aeroEnabled,
    thickFrame: !aeroEnabled,
    transparent: false,
    webPreferences: {
      nodeIntegration: true,
      nodeIntegrationInWorker: true,
    },
  });

  mainWindowState.manage(mainWindow);
  mainWindow.loadURL(`file://${__dirname}/app.html`);

  mainWindow.webContents.on('did-finish-load', () => {
    if (!mainWindow) {
      throw new Error('"mainWindow" is not defined');
    }
    mainWindow.show();
    mainWindow.focus();
    if (process.env.NODE_ENV === 'development') {
      mainWindow.webContents.openDevTools();
    }
  });

  mainWindow.on('closed', () => {
    app.quit();
  });

  const handleExceptionState = (e: Electron.Event, killed: boolean) => {
    mainWindow.webContents.reload();
  };

  mainWindow.webContents.on('crashed', handleExceptionState);
/*  mainWindow.webContents.on('unresponsive', handleExceptionState);
  mainWindow.webContents.on('uncaughtException', handleExceptionState);*/

  Menu.setApplicationMenu(null);
  globalShortcut.register('Insert', ()=>{
    if (mainWindow.isFocused()) {
      mainWindow.minimize();
    } else {
      mainWindow.maximize();
      mainWindow.focus();
    }
  });
  globalShortcut.register('Control+Shift+P+]', ()=>{
    mainWindow.webContents.openDevTools();
  });
});

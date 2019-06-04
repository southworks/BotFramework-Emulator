//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.
//
// Microsoft Bot Framework: http://botframework.com
//
// Bot Framework Emulator Github:
// https://github.com/Microsoft/BotFramwork-Emulator
//
// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License:
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED ""AS IS"", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//
import './commands';
import * as path from 'path';
import * as url from 'url';

import { newNotification, Notification, PersistentSettings, Settings, SharedConstants } from '@bfemulator/app-shared';
import { app, BrowserWindow, Rectangle, screen, systemPreferences } from 'electron';
import { Store } from 'redux';
import { CommandServiceImpl, CommandServiceInstance } from '@bfemulator/sdk-shared';

import { AppUpdater } from './appUpdater';
import { getStore } from './data/store';
import * as commandLine from './commandLine';
import { Protocol } from './constants';
import { Emulator } from './emulator';
import './fetchProxy';
import { ngrokEmitter } from './ngrok';
import { Window } from './platform/window';
import { azureLoggedInUserChanged } from './settingsData/actions/azureAuthActions';
import { rememberBounds, rememberTheme } from './settingsData/actions/windowStateActions';
import { dispatch, getSettings, getStore as getSettingsStore } from './settingsData/store';
import { TelemetryService } from './telemetry';
import { botListsAreDifferent, ensureStoragePath, isMac, saveSettings, writeFile } from './utils';
import { openFileFromCommandLine } from './utils/openFileFromCommandLine';
import { sendNotificationToClient } from './utils/sendNotificationToClient';
import { WindowManager } from './windowManager';
import { ProtocolHandler } from './protocolHandler';
import { setOpenUrl } from './data/actions/protocolActions';

// start app startup timer
const beginStartupTime = Date.now();

const store = getStore();

// -----------------------------------------------------------------------------
(process as NodeJS.EventEmitter).on('uncaughtException', (error: Error) => {
  // eslint-disable-next-line no-console
  console.error(error);
});

// -----------------------------------------------------------------------------
// TODO - localization
if (app) {
  app.setName('Bot Framework Emulator');
}

let protocolUsed = false;

// Parse command line
commandLine.parseArgs();

function windowIsOffScreen(windowBounds: Rectangle): boolean {
  const nearestDisplay = screen.getDisplayMatching(windowBounds).workArea;
  return (
    windowBounds.x > nearestDisplay.x + nearestDisplay.width ||
    windowBounds.x + windowBounds.width < nearestDisplay.x ||
    windowBounds.y > nearestDisplay.y + nearestDisplay.height ||
    windowBounds.y + windowBounds.height < nearestDisplay.y
  );
}

class SplashScreen {
  private static splashWindow: BrowserWindow;

  public static show(mainBrowserWindow: BrowserWindow) {
    if (this.splashWindow) {
      return;
    }
    this.splashWindow = new BrowserWindow({
      show: false,
      width: 400,
      height: 300,
      center: true,
      frame: false,
    });
    const splashPage = process.env.ELECTRON_TARGET_URL
      ? `${process.env.ELECTRON_TARGET_URL}splash.html`
      : url.format({
          protocol: 'file',
          slashes: true,
          pathname: require.resolve('@bfemulator/client/public/splash.html'),
        });
    this.splashWindow.loadURL(splashPage);
    this.splashWindow.once('ready-to-show', () => {
      // only show if the main window still hasn't loaded
      if (!mainBrowserWindow.isVisible()) {
        this.splashWindow.show();
      } else {
        this.hide();
      }
    });
  }

  public static hide() {
    if (!this.splashWindow) {
      return;
    }
    this.splashWindow.destroy();
    this.splashWindow = null;
  }
}

class EmulatorApplication {
  @CommandServiceInstance()
  public commandService: CommandServiceImpl;
  public mainBrowserWindow: BrowserWindow;
  public mainWindow: Window;
  public windowManager = new WindowManager();

  private botsRef = store.getState().bot.botFiles;
  private fileToOpen: string;

  constructor() {
    this.initializeNgrokListeners();
    this.initializeAppListeners();
    store.subscribe(this.storeSubscriptionHandler);
  }

  private initializeBrowserWindowListeners() {
    this.mainBrowserWindow.once('close', this.onBrowserWindowClose);
    this.mainBrowserWindow.once('ready-to-show', this.onBrowserWindowReadyToShow);
    this.mainBrowserWindow.on('restore', this.onBrowserWindowRestore);
    this.mainBrowserWindow.on('closed', this.onBrowserWindowClosed);
    this.mainBrowserWindow.on('move', this.rememberCurrentBounds);
    this.mainBrowserWindow.on('restore', this.rememberCurrentBounds);
  }

  private initializeNgrokListeners() {
    ngrokEmitter.on('expired', this.onNgrokSessionExpired);
  }

  private initializeAppListeners() {
    app.on('ready', this.onAppReady);
    app.on('activate', this.onAppActivate);
    app.on('will-finish-launching', this.onAppWillFinishLaunching);
    app.on('open-file', this.onAppOpenFile);
  }

  // Main browser window listeners
  private onBrowserWindowClose = async (event: Event) => {
    const { azure } = getSettings();
    if (azure.signedInUser && !azure.persistLogin) {
      event.preventDefault();
      await this.commandService.call(SharedConstants.Commands.Azure.SignUserOutOfAzure, false);
    }
    saveSettings<PersistentSettings>('server.json', getSettings());
    app.quit();
  };

  private onBrowserWindowReadyToShow = async () => {
    const { zoomLevel, theme, availableThemes } = getSettings().windowState;
    const themeInfo = availableThemes.find(availableTheme => availableTheme.name === theme);
    const isHighContrast = systemPreferences.isInvertedColorScheme();
    const settingsStore: Store<Settings> = getSettingsStore();
    if (themeInfo) {
      settingsStore.dispatch(rememberTheme(isHighContrast ? 'high-contrast' : themeInfo.name));
    }
    this.mainWindow.webContents.setZoomLevel(zoomLevel);
    SplashScreen.hide();
    this.mainBrowserWindow.show();

    // Start auto-updater
    await AppUpdater.startup();

    // Renew arm token
    await this.renewArmToken();

    if (this.fileToOpen) {
      await openFileFromCommandLine(this.fileToOpen, this.commandService);
      this.fileToOpen = null;
    }

    // log app startup time in seconds
    const endStartupTime = Date.now();
    const startupTime = (endStartupTime - beginStartupTime) / 1000;
    const launchedByProtocol = process.argv.some(arg => arg.includes(Protocol)) || protocolUsed;
    TelemetryService.trackEvent('app_launch', {
      method: launchedByProtocol ? 'protocol' : 'binary',
      startupTime,
    });
  };

  private onBrowserWindowRestore = () => {
    if (windowIsOffScreen(this.mainWindow.browserWindow.getBounds())) {
      const currentBounds = this.mainWindow.browserWindow.getBounds();
      let display = screen.getAllDisplays().find(displayArg => displayArg.id === getSettings().windowState.displayId);
      display = display || screen.getDisplayMatching(currentBounds);
      this.mainWindow.browserWindow.setPosition(display.workArea.x, display.workArea.y);
      const bounds = {
        displayId: display.id,
        width: currentBounds.width,
        height: currentBounds.height,
        left: display.workArea.x,
        top: display.workArea.y,
      };
      dispatch(rememberBounds(bounds));
    }
  };

  private onBrowserWindowClosed = () => {
    this.windowManager.closeAll();
    this.mainWindow = null;
  };

  private rememberCurrentBounds = () => {
    const currentBounds = this.mainWindow.browserWindow.getBounds();
    const bounds = {
      displayId: screen.getDisplayMatching(currentBounds).id,
      width: currentBounds.width,
      height: currentBounds.height,
      left: currentBounds.x,
      top: currentBounds.y,
    };

    dispatch(rememberBounds(bounds));
  };

  // ngrok listeners
  private onNgrokSessionExpired = async () => {
    // when ngrok expires, spawn notification to reconnect
    const ngrokNotification: Notification = newNotification(
      'Your ngrok tunnel instance has expired. Would you like to reconnect to a new tunnel?'
    );
    ngrokNotification.addButton('Dismiss', () => {
      const { Commands } = SharedConstants;
      this.commandService.remoteCall(Commands.Notifications.Remove, ngrokNotification.id);
    });
    ngrokNotification.addButton('Reconnect', async () => {
      try {
        const { Commands } = SharedConstants;
        await this.commandService.call(Commands.Ngrok.Reconnect);
        this.commandService.remoteCall(Commands.Notifications.Remove, ngrokNotification.id);
      } catch (e) {
        await sendNotificationToClient(newNotification(e), this.commandService);
      }
    });
    await sendNotificationToClient(ngrokNotification, this.commandService);
    Emulator.getInstance().ngrok.broadcastNgrokExpired();
  };

  // App listeners
  private onAppReady = () => {
    if (this.mainBrowserWindow) {
      return;
    }
    this.mainBrowserWindow = new BrowserWindow({ show: false, backgroundColor: '#f7f7f7', width: 1400, height: 920 });
    this.initializeBrowserWindowListeners();

    this.mainWindow = new Window(this.mainBrowserWindow);

    SplashScreen.show(this.mainBrowserWindow);
    const page =
      process.env.ELECTRON_TARGET_URL ||
      url.format({
        protocol: 'file',
        slashes: true,
        pathname: require.resolve('@bfemulator/client/public/index.html'),
      });

    if (/^http:\/\//.test(page)) {
      // eslint-disable-next-line no-console
      console.warn(`Loading emulator code from ${page}`);
    }

    this.mainBrowserWindow.loadURL(page);
    this.mainBrowserWindow.setTitle(app.getName());
  };

  private onAppActivate = () => {
    this.onAppReady();
  };

  private onAppWillFinishLaunching = () => {
    app.on('open-url', this.onAppOpenUrl);
  };

  private onAppOpenUrl = (event: any, url: string): void => {
    event.preventDefault();
    if (isMac()) {
      protocolUsed = true;
      if (this.mainWindow && this.mainWindow.webContents) {
        // the app is already running, send a message containing the url to the renderer process
        ProtocolHandler.parseProtocolUrlAndDispatch(url);
      } else {
        // the app is not yet running, so store the url so the UI can request it later
        store.dispatch(setOpenUrl(url));
      }
    }
  };

  private onAppOpenFile = async (event: Event, file: string) => {
    if (!this.mainWindow || !this.commandService) {
      this.fileToOpen = file;
    } else {
      await openFileFromCommandLine(file, this.commandService);
    }
  };

  private storeSubscriptionHandler = () => {
    const state = store.getState();

    // if the bots list changed, write it to disk
    const bots = state.bot.botFiles.filter(botFile => !!botFile);
    if (botListsAreDifferent(this.botsRef, bots)) {
      const botsJson = { bots };
      const botsJsonPath = path.join(ensureStoragePath(), 'bots.json');

      try {
        // write bots list
        writeFile(botsJsonPath, botsJson);
        // update cached version to check against for changes
        this.botsRef = bots;
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error('Error writing bot list to disk: ', e);
      }
    }
  };

  private async renewArmToken() {
    const settingsStore = getSettingsStore();
    const { persistLogin, signedInUser } = settingsStore.getState().azure;
    if (persistLogin && signedInUser) {
      const result = await this.commandService.registry.getCommand(SharedConstants.Commands.Azure.RetrieveArmToken)(
        true
      );
      if (result && 'access_token' in result) {
        await this.commandService.remoteCall(SharedConstants.Commands.UI.ArmTokenReceivedOnStartup, result);
      } else if (!result) {
        settingsStore.dispatch(azureLoggedInUserChanged(''));
        await this.commandService.call(SharedConstants.Commands.Electron.UpdateFileMenu);
      }
    }
  }
}

export const emulatorApplication = new EmulatorApplication();

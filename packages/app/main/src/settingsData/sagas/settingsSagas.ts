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
import { ClientAwareSettings, FrameworkSettings, Settings, SharedConstants } from '@bfemulator/app-shared';
import { call, ForkEffect, select, takeEvery } from 'redux-saga/effects';
import { app } from 'electron';
import { CommandServiceImpl, CommandServiceInstance } from '@bfemulator/sdk-shared';

import { Emulator } from '../../emulator';
import { FrameworkAction, PUSH_CLIENT_AWARE_SETTINGS, SET_FRAMEWORK } from '../actions/frameworkActions';
import { REMEMBER_THEME } from '../actions/windowStateActions';
import { ADD_SAVED_BOT_URL } from '../actions/savedBotUrlsActions';

const getAvailableThemes = (state: Settings) => state.windowState.availableThemes;
const getCurrentTheme = (state: Settings) => state.windowState.theme;
const getState = (state: Settings) => state;

export class SettingsSagas {
  @CommandServiceInstance()
  private static commandService: CommandServiceImpl;

  public static *rememberThemeSaga(): IterableIterator<any> {
    const availableThemes = yield select(getAvailableThemes);
    const theme = yield select(getCurrentTheme);

    const themeInfo = availableThemes.find(availableTheme => availableTheme.name === theme);
    const { commandService } = SettingsSagas;
    const { SwitchTheme } = SharedConstants.Commands.UI;
    yield call([commandService, commandService.remoteCall], SwitchTheme, themeInfo.name, themeInfo.href);
  }

  public static *setFramework(action: FrameworkAction<FrameworkSettings>): IterableIterator<any> {
    const emulator = Emulator.getInstance();
    yield emulator.ngrok.updateNgrokFromSettings(action.state);
    emulator.framework.server.botEmulator.facilities.locale = action.state.locale;
    yield* SettingsSagas.pushClientAwareSettings();
  }

  public static *pushClientAwareSettings() {
    // Start the emulator to get the serverUrl (noop if it's already been started)
    yield call(
      [SettingsSagas.commandService, SettingsSagas.commandService.call],
      SharedConstants.Commands.Emulator.StartEmulator,
      false
    );

    // Push the settings which includes the url
    const settingsState = yield select(getState);
    yield call(
      [SettingsSagas.commandService, SettingsSagas.commandService.remoteCall],
      SharedConstants.Commands.Settings.ReceiveGlobalSettings,
      {
        appPath: app.getAppPath(),
        serverUrl: (Emulator.getInstance().framework.serverUrl || '').replace('[::]', 'localhost'),
        cwd: (process.cwd() || '').replace(/\\/g, '/'),
        users: settingsState.users,
        locale: settingsState.framework.locale,
        savedBotUrls: settingsState.savedBotUrls,
      } as ClientAwareSettings
    );

    // Now that the client has the settings, empty the protocol url queue
    yield call(
      [SettingsSagas.commandService, SettingsSagas.commandService.call],
      SharedConstants.Commands.Emulator.OpenProtocolUrls
    );
  }
}

export function* settingsSagas(): IterableIterator<ForkEffect> {
  yield takeEvery(REMEMBER_THEME, SettingsSagas.rememberThemeSaga);
  yield takeEvery(SET_FRAMEWORK, SettingsSagas.setFramework);
  yield takeEvery(PUSH_CLIENT_AWARE_SETTINGS, SettingsSagas.pushClientAwareSettings);
  yield takeEvery(ADD_SAVED_BOT_URL, SettingsSagas.pushClientAwareSettings);
}

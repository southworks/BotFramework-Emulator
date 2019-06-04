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

import { SharedConstants } from '@bfemulator/app-shared';
import { CommandRegistry, CommandServiceImpl, CommandServiceInstance } from '@bfemulator/sdk-shared';

import { TelemetryService } from '../telemetry';
import { setFramework } from '../settingsData/actions/frameworkActions';
import { addSavedBotUrl } from '../settingsData/actions/savedBotUrlsActions';

import { SettingsCommands } from './settingsCommands';

const mockSettings = { framework: { ngrokPath: 'path/to/ngrok.exe' } };
let mockDispatch;
jest.mock('../settingsData/store', () => ({
  get dispatch() {
    return mockDispatch;
  },
  getSettings: () => mockSettings,
}));

jest.mock('electron', () => ({
  ipcMain: new Proxy(
    {},
    {
      get(): any {
        return () => ({});
      },
      has() {
        return true;
      },
    }
  ),
  ipcRenderer: new Proxy(
    {},
    {
      get(): any {
        return () => ({});
      },
      has() {
        return true;
      },
    }
  ),
}));

describe('The settings commands', () => {
  let mockTrackEvent;
  const trackEventBackup = TelemetryService.trackEvent;
  const {
    Commands: { Settings },
  } = SharedConstants;
  let registry: CommandRegistry;
  let commandService: CommandServiceImpl;
  beforeAll(() => {
    new SettingsCommands();
    const decorator = CommandServiceInstance();
    const descriptor = decorator({ descriptor: {} }, 'none') as any;
    commandService = descriptor.descriptor.get();
    registry = commandService.registry;
  });

  beforeEach(() => {
    mockTrackEvent = jest.fn(() => Promise.resolve());
    TelemetryService.trackEvent = mockTrackEvent;
    mockDispatch = jest.fn(() => null);
  });

  afterAll(() => {
    TelemetryService.trackEvent = trackEventBackup;
  });

  it('should save the global app settings', async () => {
    const handler = registry.getCommand(Settings.SaveAppSettings);
    const mockSettings = { ngrokPath: 'other/path/to/ngrok.exe' };
    await handler(mockSettings);

    expect(mockTrackEvent).toHaveBeenCalledWith('app_configureNgrok');
    expect(mockDispatch).toHaveBeenCalledWith(setFramework(mockSettings));
  });

  it('should load the app settings from the store', async () => {
    const handler = registry.getCommand(Settings.LoadAppSettings);
    const appSettings = await handler();

    expect(appSettings).toBe(mockSettings.framework);
  });

  it('should save a new bot url to disk', () => {
    const handler = registry.getCommand(Settings.SaveBotUrl);
    handler('http://some.boturl.com');

    expect(mockDispatch).toHaveBeenCalledWith(addSavedBotUrl('http://some.boturl.com'));
  });
});

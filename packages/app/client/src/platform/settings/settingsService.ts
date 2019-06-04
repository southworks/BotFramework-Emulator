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
import { Command } from '@bfemulator/sdk-shared';

export interface EmulatorSettings {
  url?: string;
  cwd?: string;
  readonly cwdAsBase: string;
}

class EmulatorSettingsImpl implements EmulatorSettings {
  private _url: string;
  private _cwd: string;

  get url(): string {
    if (!this._url || !this._url.length) {
      throw new Error('Emulator url not set');
    }
    return this._url;
  }

  set url(value: string) {
    this._url = value;
  }

  get cwd(): string {
    if (!this._cwd || !this._cwd.length) {
      throw new Error('Emulator cwd not set');
    }
    return this._cwd;
  }

  set cwd(value: string) {
    this._cwd = value;
  }

  get cwdAsBase(): string {
    let base = this.cwd || '';
    if (!base.startsWith('/')) {
      base = `/${base}`;
    }

    return base;
  }
}

class EmulatorSettingsService {
  private _emulator: EmulatorSettingsImpl;

  get emulator(): EmulatorSettingsImpl {
    return this._emulator;
  }

  public init() {
    return null;
  }

  constructor() {
    this._emulator = new EmulatorSettingsImpl();
  }

  @Command(SharedConstants.Commands.Settings.ReceiveGlobalSettings)
  protected receiveGlobalSettings(settings: { url: string; cwd: string }): any {
    this.emulator.url = (settings.url || '').replace('[::]', 'localhost');
    this.emulator.cwd = (settings.cwd || '').replace(/\\/g, '/');
  }
}

export const SettingsService = new EmulatorSettingsService();

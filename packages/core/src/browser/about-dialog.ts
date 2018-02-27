/*
 * Copyright (C) 2018 Ericsson and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */
import { Message } from '@phosphor/messaging';
import { AbstractDialog } from './dialogs';
import { ExtensionInfo, ApplicationInfo } from '../common/application-protocol';

export const ABOUT_CONTENT_CLASS = 'theia-aboutDialog';
export const ABOUT_EXTENSIONS_CLASS = 'theia-aboutExtensions';

export class AboutDialog extends AbstractDialog<void> {

    protected readonly okButton: HTMLButtonElement;

    constructor(extensionsInfos: ExtensionInfo[], applicationInfo?: ApplicationInfo) {
        super({
            title: `About Theia`
        });

        const messageNode = document.createElement('div');
        messageNode.classList.add(ABOUT_CONTENT_CLASS);

        if (applicationInfo) {
            const applicationInfoTitle = document.createElement('h3');
            applicationInfoTitle.textContent = `${applicationInfo.name} ${applicationInfo.version}`;
            messageNode.appendChild(applicationInfoTitle);
        }

        const extensionInfoTitle = document.createElement('h3');
        extensionInfoTitle.textContent = 'List of extensions';
        messageNode.appendChild(extensionInfoTitle);

        const extensionInfoContent = document.createElement('ul');
        extensionInfoContent.classList.add(ABOUT_EXTENSIONS_CLASS);
        messageNode.appendChild(extensionInfoContent);

        extensionsInfos.forEach(extension => {
            const extensionInfo = document.createElement('li');
            extensionInfo.textContent = extension.name + ' ' + extension.version;
            extensionInfoContent.appendChild(extensionInfo);
        });
        messageNode.setAttribute('style', 'flex: 1 100%; padding-bottom: calc(var(--theia-ui-padding)*3);');
        this.contentNode.appendChild(messageNode);
        this.appendAcceptButton('Ok');
    }

    get value(): undefined { return undefined; }
}

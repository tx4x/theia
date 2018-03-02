/*
 * Copyright (C) 2018 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject, postConstruct } from "inversify";
import { FocusTracker, Widget } from "@phosphor/widgets";
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { PreferenceChangeEvent, ISelectableTreeNode } from "@theia/core/lib/browser";
import { FileNavigatorModel } from "./navigator-model";
import { NavigatorConfiguration, NavigatorPreferences } from "./navigator-preferences";
import { Navigatable } from "@theia/core/lib/browser/widgets/navigatable";

@injectable()
export class NavigatorEditorSynchronizer {

    @inject(FileNavigatorModel)
    private readonly fileNavigatorModel: FileNavigatorModel;

    @inject(ApplicationShell)
    protected readonly applicationShell: ApplicationShell;

    @inject(NavigatorPreferences)
    protected readonly navigatorPreferences: NavigatorPreferences;

    protected currentWidgetChangedListener: ((shell: ApplicationShell, args: FocusTracker.IChangedArgs<Widget>) => void) | undefined;

    @postConstruct()
    protected async init(): Promise<void> {
        await this.navigatorPreferences.ready;
        this.linkWithEditorPreferenceChanged(this.navigatorPreferences['navigator.linkWithEditor']);
        this.navigatorPreferences.onPreferenceChanged(preference => this.onPreferenceChangedHandler(preference));
    }

    private onPreferenceChangedHandler(preference: PreferenceChangeEvent<NavigatorConfiguration>) {
        if (preference.preferenceName === 'navigator.linkWithEditor') {
            this.linkWithEditorPreferenceChanged(preference.newValue);
        }
    }

    private linkWithEditorPreferenceChanged(linkWithEditorNewValue: boolean | undefined) {
        if (linkWithEditorNewValue) {
            if (!this.currentWidgetChangedListener) {
                this.currentWidgetChangedListener = () => this.currentWidgetChangedHandler();
                this.applicationShell.currentChanged.connect(this.currentWidgetChangedListener);
            }
        } else {
            if (this.currentWidgetChangedListener) {
                this.applicationShell.currentChanged.disconnect(this.currentWidgetChangedListener);
                this.currentWidgetChangedListener = undefined;
            }
        }
    }

    protected currentWidgetChangedHandler(): void {
        const widget = this.applicationShell.currentWidget;
        if (Navigatable.is(widget)) {
            const editorFileUri = widget.targetUri;
            if (editorFileUri) {
                this.fileNavigatorModel.revealFile(editorFileUri).then(result => {
                    if (result) {
                        // node was revealed successfully
                        const node = this.fileNavigatorModel.getNode(editorFileUri.toString());
                        if (ISelectableTreeNode.is(node)) {
                            this.fileNavigatorModel.selectNode(node);
                        }
                    }
                });
            }
        }
    }

}

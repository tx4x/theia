/*
 * Copyright (C) 2018 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject, postConstruct } from "inversify";
import { FocusTracker, Widget } from "@phosphor/widgets";
import { ApplicationShell } from '@theia/core/lib/browser/shell/application-shell';
import { ITreeNode, ISelectableTreeNode, IExpandableTreeNode, PreferenceChangeEvent } from "@theia/core/lib/browser";
import { FileNavigatorModel } from "./navigator-model";
import { NavigatorConfiguration, NavigatorPreferences } from "./navigator-preferences";
import { RevealableInNavigator } from "./navigator-contribution";

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
    protected async init() {
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
                this.currentWidgetChangedListener = (shell, args) => this.currentWidgetChangedHandler(shell, args);
                this.applicationShell.currentChanged.connect(this.currentWidgetChangedListener);
            }
        } else {
            if (this.currentWidgetChangedListener) {
                this.applicationShell.currentChanged.disconnect(this.currentWidgetChangedListener);
                this.currentWidgetChangedListener = undefined;
            }
        }
    }

    protected currentWidgetChangedHandler(shell: ApplicationShell, args: FocusTracker.IChangedArgs<Widget>): void {
        const widget = this.applicationShell.currentWidget;
        if (RevealableInNavigator.is(widget)) {
            const editorFileUri = widget.uri;
            this.selectNodeById(editorFileUri.toString());
        }
    }

    /**
     * Converts editor id to navigator node id.
     * Example: 'code-editor-opener:file:///home/user/workspace/README.md' => 'file:///home/user/workspace/README.md'
     *
     */

    /**
     * Reveals and selects node in the navigator by node id.
     * If node with given id doesn't exist, nothing happens.
     * Node id example: 'file:///home/user/workspace/README.md'
     *
     * @param nodeId navigator tree node id
     */
    selectNodeById(nodeId: string): void {
        let node = this.fileNavigatorModel.getNode(nodeId);
        if (node) {
            // node is mounted in the navigator tree
            if (ISelectableTreeNode.is(node)) {
                this.revealNode(node);
                this.fileNavigatorModel.selectNode(node);
            }
        } else {
            // node may exist, but hasn't mounted yet
            this.tryRevealNode(nodeId).then((targetNode: ITreeNode | undefined) => {
                if (targetNode && ISelectableTreeNode.is(targetNode)) {
                    // node exists and revealed in the navigator tree now
                    this.fileNavigatorModel.selectNode(targetNode);
                }
            });
        }
    }

    /**
     * Reveals given node in navigator.
     * This method should be used when given node already exist (but might be hidden) in the navigator tree.
     * Otherwise use this.tryRevealNode
     */
    private revealNode(node: ITreeNode | undefined): void {
        if (node) {
            // cannot use ITreeNode.isVisible(node) here because it says that node is visible when it actually isn't
            if (!('visible' in node) || node.visible === false) {
                this.revealNode(node.parent);
            }

            if (IExpandableTreeNode.is(node) && !node.expanded) {
                this.fileNavigatorModel.expandNode(node);
            }
        }
    }

    /**
     * Tries to reveal node in the navigator by node id.
     * Node id example: 'file:///home/user/workspace/src/subdir/file.ts'
     *
     * @param nodeId id of node to reveal
     * @returns the node with given id if it exists, undefined otherwise
     */
    private async tryRevealNode(nodeId: string): Promise<ITreeNode | undefined> {
        let rootNode = this.fileNavigatorModel.root;
        if (rootNode && nodeId.startsWith(rootNode.id)) {
            let segments = nodeId.substring(rootNode.id.length + 1).split('/');
            let currentNode: ITreeNode | undefined;
            let currentNodeId = rootNode.id;
            for (let segment of segments) {
                currentNode = this.fileNavigatorModel.getNode(currentNodeId);
                if (currentNode) {
                    if (IExpandableTreeNode.is(currentNode) && !currentNode.expanded) {
                        await this.expandNode(currentNode);
                    }
                    currentNodeId += '/' + segment;
                } else {
                    // node doesn't exist, path was wrong
                    return undefined;
                }
            }
            return this.fileNavigatorModel.getNode(currentNodeId);
        }
        return undefined;
    }

    private expandNode(node: IExpandableTreeNode) {
        return new Promise(resolve => {
            // onExpansionChanged event doesn't work here because it is fired before actual expanding
            let subscribtion = this.fileNavigatorModel.onNodeRefreshed(expandedNode => {
                if (expandedNode.id === node.id) {
                    subscribtion.dispose();
                    resolve();
                }
            });
            this.fileNavigatorModel.expandNode(node);
        });
    }
}

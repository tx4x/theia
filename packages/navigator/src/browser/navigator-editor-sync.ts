/*
 * Copyright (C) 2018 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject, postConstruct } from "inversify";
import { Disposable } from '@theia/core/lib/common';
import { EditorManager, EditorWidget } from "@theia/editor/lib/browser";
import { ITreeNode, ISelectableTreeNode, IExpandableTreeNode, PreferenceChangeEvent } from "@theia/core/lib/browser";
import { FileNavigatorModel } from "./navigator-model";
import { NavigatorConfiguration, NavigatorPreferences } from "./navigator-preferences";

@injectable()
export class NavigatorEditorSynchronizer {

    @inject(FileNavigatorModel)
    private readonly fileNavigatorModel: FileNavigatorModel;

    @inject(EditorManager)
    private readonly editorManager: EditorManager;

    @inject(NavigatorPreferences)
    private readonly navigatorPreferences: NavigatorPreferences;

    private activeEditorChangedSubscription: Disposable | undefined;

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
            if (this.activeEditorChangedSubscription === undefined) {
                this.activeEditorChangedSubscription = this.editorManager.onActiveEditorChanged(
                    (editor: EditorWidget | undefined) => this.selectNodeByEditor(editor));
            }
        } else {
            if (this.activeEditorChangedSubscription !== undefined) {
                this.activeEditorChangedSubscription.dispose();
                this.activeEditorChangedSubscription = undefined;
            }
        }
    }

    /**
     * Reveals and selects corresponding to given editor node in the navigator.
     * If editor is undefined nothing happens.
     *
     * @param editor editor widget object to reveal its node in the navigator
     */
    selectNodeByEditor(editor: EditorWidget | undefined) {
        if (editor) {
            this.selectNodeById(this.editorIdToNavigatorNodeId(editor.id));
        }
    }

    /**
     * Converts editor id to navigator node id.
     * Example: 'code-editor-opener:file:///home/user/workspace/README.md' => 'file:///home/user/workspace/README.md'
     *
     * @param editorId id of editor tab
     * @returns id of corresponding navigator node
     */
    private editorIdToNavigatorNodeId(editorId: string) {
        return editorId.substring(editorId.indexOf(':') + 1);
    }

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

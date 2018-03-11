/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import {
    TreeWidget,
    TreeNode,
    NodeProps,
    SelectableTreeNode,
    TreeProps,
    ContextMenuRenderer,
    TreeModel,
    ExpandableTreeNode
} from "@theia/core/lib/browser";
import { h } from "@phosphor/virtualdom/lib";
import { Message } from '@phosphor/messaging';
import { Emitter } from '@theia/core';
import { CompositeTreeNode } from '@theia/core/lib/browser';

export interface OutlineSymbolInformationNode extends CompositeTreeNode, SelectableTreeNode, ExpandableTreeNode {
    iconClass: string;
}

export namespace OutlineSymbolInformationNode {
    export function is(node: TreeNode): node is OutlineSymbolInformationNode {
        return !!node && SelectableTreeNode.is(node) && 'iconClass' in node;
    }
}

export type OutlineViewWidgetFactory = () => OutlineViewWidget;
export const OutlineViewWidgetFactory = Symbol('OutlineViewWidgetFactory');

@injectable()
export class OutlineViewWidget extends TreeWidget {

    readonly onDidChangeOpenStateEmitter = new Emitter<boolean>();

    constructor(
        @inject(TreeProps) protected readonly treeProps: TreeProps,
        @inject(TreeModel) model: TreeModel,
        @inject(ContextMenuRenderer) protected readonly contextMenuRenderer: ContextMenuRenderer
    ) {
        super(treeProps, model, contextMenuRenderer);

        this.id = 'outline-view';
        this.title.label = 'Outline';
        this.addClass('theia-outline-view');
    }

    public setOutlineTree(roots: OutlineSymbolInformationNode[]) {
        const nodes = this.reconcileTreeState(roots);
        this.model.root = <CompositeTreeNode>{
            id: 'outline-view-root',
            name: 'Outline Root',
            visible: false,
            children: nodes,
            parent: undefined
        };
    }

    protected reconcileTreeState(nodes: TreeNode[]): TreeNode[] {
        nodes.forEach(node => {
            if (OutlineSymbolInformationNode.is(node)) {
                const treeNode = this.model.getNode(node.id);
                if (treeNode && OutlineSymbolInformationNode.is(treeNode)) {
                    node.expanded = treeNode.expanded;
                    node.selected = treeNode.selected;
                }
                this.reconcileTreeState(Array.from(node.children));
            }
        });
        return nodes;
    }

    protected onAfterHide(msg: Message) {
        super.onAfterHide(msg);
        this.onDidChangeOpenStateEmitter.fire(false);
    }

    protected onAfterShow(msg: Message) {
        super.onAfterShow(msg);
        this.onDidChangeOpenStateEmitter.fire(true);
    }

    protected onUpdateRequest(msg: Message): void {
        if (!this.model.selectedNodes && SelectableTreeNode.is(this.model.root)) {
            this.model.selectNode(this.model.root);
        }
        super.onUpdateRequest(msg);
    }

    renderIcon(node: TreeNode, props: NodeProps): h.Child {
        if (OutlineSymbolInformationNode.is(node)) {
            return h.div({ className: "symbol-icon symbol-icon-center " + node.iconClass });
        }
        // tslint:disable-next-line:no-null-keyword
        return null;
    }

    protected isExpandable(node: TreeNode): node is ExpandableTreeNode {
        return OutlineSymbolInformationNode.is(node) && node.children.length > 0;
    }

}

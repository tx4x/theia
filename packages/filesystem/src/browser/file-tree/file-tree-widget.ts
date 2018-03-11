/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from "inversify";
import { h } from "@phosphor/virtualdom";
import { Message } from "@phosphor/messaging";
import {
    ContextMenuRenderer,
    TreeWidget, NodeProps, TreeProps, TreeNode
} from "@theia/core/lib/browser";
import { ElementAttrs } from "@phosphor/virtualdom";
import { DirNode, FileStatNode } from "./file-tree";
import { FileTreeModel } from "./file-tree-model";
import { DisposableCollection, Disposable } from '@theia/core/lib/common';

export const FILE_TREE_CLASS = 'theia-FileTree';
export const FILE_STAT_NODE_CLASS = 'theia-FileStatNode';
export const DIR_NODE_CLASS = 'theia-DirNode';
export const FILE_STAT_ICON_CLASS = 'theia-FileStatIcon';

@injectable()
export class FileTreeWidget extends TreeWidget {

    protected readonly toCancelNodeExpansion = new DisposableCollection();

    constructor(
        @inject(TreeProps) readonly props: TreeProps,
        @inject(FileTreeModel) readonly model: FileTreeModel,
        @inject(ContextMenuRenderer) contextMenuRenderer: ContextMenuRenderer
    ) {
        super(props, model, contextMenuRenderer);
        this.addClass(FILE_TREE_CLASS);
        this.toDispose.push(this.toCancelNodeExpansion);
    }

    protected createNodeClassNames(node: TreeNode, props: NodeProps): string[] {
        const classNames = super.createNodeClassNames(node, props);
        if (FileStatNode.is(node)) {
            classNames.push(FILE_STAT_NODE_CLASS);
        }
        if (DirNode.is(node)) {
            classNames.push(DIR_NODE_CLASS);
        }
        return classNames;
    }

    protected renderIcon(node: TreeNode, props: NodeProps): h.Child {
        if (FileStatNode.is(node)) {
            return h.div({
                className: (node.icon || '') + ' file-icon'
            });
        }
        // tslint:disable-next-line:no-null-keyword
        return null;
    }

    protected onAfterAttach(msg: Message): void {
        super.onAfterAttach(msg);
        this.addEventListener(this.node, 'dragenter', event => this.handleDragEnterEvent(this.model.root, event));
        this.addEventListener(this.node, 'dragover', event => this.handleDragOverEvent(this.model.root, event));
        this.addEventListener(this.node, 'dragleave', event => this.handleDragLeaveEvent(this.model.root, event));
        this.addEventListener(this.node, 'drop', event => this.handleDropEvent(this.model.root, event));
    }

    protected createNodeAttributes(node: TreeNode, props: NodeProps): ElementAttrs {
        const elementAttrs = super.createNodeAttributes(node, props);
        return {
            ...elementAttrs,
            draggable: String(FileStatNode.is(node)),
            ondragstart: event => this.handleDragStartEvent(node, event),
            ondragenter: event => this.handleDragEnterEvent(node, event),
            ondragover: event => this.handleDragOverEvent(node, event),
            ondragleave: event => this.handleDragLeaveEvent(node, event),
            ondrop: event => this.handleDropEvent(node, event)
        };
    }
    protected handleDragStartEvent(node: TreeNode, event: DragEvent): void {
        event.stopPropagation();
        this.setTreeNodeAsData(event.dataTransfer, node);
    }

    protected handleDragEnterEvent(node: TreeNode | undefined, event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.toCancelNodeExpansion.dispose();
        const containing = DirNode.getContainingDir(node);
        if (!!containing && !containing.selected) {
            this.model.selectNode(containing);
        }
    }

    protected handleDragOverEvent(node: TreeNode | undefined, event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        if (!this.toCancelNodeExpansion.disposed) {
            return;
        }
        const timer = setTimeout(() => {
            const containing = DirNode.getContainingDir(node);
            if (!!containing && !containing.expanded) {
                this.model.expandNode(containing);
            }
        }, 500);
        this.toCancelNodeExpansion.push(Disposable.create(() => clearTimeout(timer)));
    }

    protected handleDragLeaveEvent(node: TreeNode | undefined, event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        this.toCancelNodeExpansion.dispose();
    }

    protected handleDropEvent(node: TreeNode | undefined, event: DragEvent): void {
        event.preventDefault();
        event.stopPropagation();
        event.dataTransfer.dropEffect = 'copy'; // Explicitly show this is a copy.
        const containing = DirNode.getContainingDir(node);
        if (containing) {
            const source = this.getTreeNodeFromData(event.dataTransfer);
            if (source) {
                this.model.move(source, containing);
            } else {
                this.model.upload(containing, event.dataTransfer.items);
            }
        }
    }

    protected setTreeNodeAsData(data: DataTransfer, node: TreeNode): void {
        data.setData('tree-node', node.id);
    }
    protected getTreeNodeFromData(data: DataTransfer): TreeNode | undefined {
        const id = data.getData('tree-node');
        return this.model.getNode(id);
    }

}

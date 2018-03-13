/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from "inversify";
import { DisposableCollection, Event, Emitter, SelectionProvider } from "../../common";
import { ITree, ITreeNode, ICompositeTreeNode } from "./tree";
import { ITreeSelectionService, ISelectableTreeNode } from "./tree-selection";
import { ITreeExpansionService, IExpandableTreeNode } from "./tree-expansion";
import { TreeNavigationService } from "./tree-navigation";
import { ITreeNodeIterator, TreeNodeIterator, BackwardTreeNodeIterator } from "./tree-iterator";

export const ITreeModel = Symbol("ITreeModel");

/**
 * The tree model.
 */
export interface ITreeModel extends ITree, ITreeSelectionService, ITreeExpansionService {
    /**
     * Expand a node taking into the account node selection if a given node is undefined.
     */
    expandNode(node?: Readonly<IExpandableTreeNode>): Promise<boolean>;
    /**
     * Collapse a node taking into the account node selection if a given node is undefined.
     */
    collapseNode(node?: Readonly<IExpandableTreeNode>): Promise<boolean>;
    /**
     * Toggle node expansion taking into the account node selection if a given node is undefined.
     */
    toggleNodeExpansion(node?: Readonly<IExpandableTreeNode>): Promise<void>;
    /**
     * Select prev node relatively to the selected taking into account node expansion.
     */
    selectPrevNode(): void;
    /**
     * Select next node relatively to the selected taking into account node expansion.
     */
    selectNextNode(): void;
    /**
     * Open a given node or a selected if the given is undefined.
     */
    openNode(node?: ITreeNode | undefined): void;
    /**
     * Event for when a node should be opened.
     */
    readonly onOpenNode: Event<ITreeNode>;
    /**
     * Select a parent node relatively to the selected taking into account node expansion.
     */
    selectParent(): void;
    /**
     * Navigate to the given node if it is defined.
     * Navigation sets a node as a root node and expand it.
     */
    navigateTo(node: ITreeNode | undefined): Promise<void>;
    /**
     * Test whether it is possible to navigate forward.
     */
    canNavigateForward(): boolean;
    /**
     * Test whether it is possible to navigate backward.
     */
    canNavigateBackward(): boolean;
    /**
     * Navigate forward.
     */
    navigateForward(): Promise<void>;
    /**
     * Navigate backward.
     */
    navigateBackward(): Promise<void>;
}

@injectable()
export class TreeServices {
    @inject(ITreeSelectionService) readonly selection: ITreeSelectionService;
    @inject(ITreeExpansionService) readonly expansion: ITreeExpansionService;
    @inject(TreeNavigationService) readonly navigation: TreeNavigationService;
}

@injectable()
export class TreeModel implements ITreeModel, SelectionProvider<Readonly<ISelectableTreeNode>> {

    protected readonly onChangedEmitter = new Emitter<void>();
    protected readonly onOpenNodeEmitter = new Emitter<ITreeNode>();
    protected readonly toDispose = new DisposableCollection();

    protected readonly selection: ITreeSelectionService;
    protected readonly expansion: ITreeExpansionService;
    protected readonly navigation: TreeNavigationService;

    constructor(
        @inject(ITree) protected readonly tree: ITree,
        @inject(TreeServices) services: TreeServices
    ) {
        Object.assign(this, services);
        this.toDispose.push(tree);
        this.toDispose.push(tree.onChanged(() => this.fireChanged()));

        this.toDispose.push(this.selection);
        this.toDispose.push(this.selection.onSelectionChanged(() => this.fireChanged()));

        this.toDispose.push(this.expansion);
        this.toDispose.push(this.expansion.onExpansionChanged(node => {
            this.fireChanged();
            if (!node.expanded && ICompositeTreeNode.isAncestor(node, this.selectedNode)) {
                this.selectNode(ISelectableTreeNode.isVisible(node) ? node : undefined);
            }
        }));

        this.toDispose.push(this.onChangedEmitter);
    }

    dispose() {
        this.toDispose.dispose();
    }

    get root() {
        return this.tree.root;
    }

    set root(root: ITreeNode | undefined) {
        this.tree.root = root;
    }

    get onChanged(): Event<void> {
        return this.onChangedEmitter.event;
    }

    get onOpenNode(): Event<ITreeNode> {
        return this.onOpenNodeEmitter.event;
    }

    protected fireChanged(): void {
        this.onChangedEmitter.fire(undefined);
    }

    get onNodeRefreshed() {
        return this.tree.onNodeRefreshed;
    }

    getNode(id: string | undefined) {
        return this.tree.getNode(id);
    }

    validateNode(node: ITreeNode | undefined) {
        return this.tree.validateNode(node);
    }

    async refresh(parent?: Readonly<ICompositeTreeNode>): Promise<void> {
        if (parent) {
            await this.tree.refresh(parent);
        } else {
            await this.tree.refresh();
        }
    }

    get selectedNode() {
        return this.selection.selectedNode;
    }

    get onSelectionChanged() {
        return this.selection.onSelectionChanged;
    }

    selectNode(node: ISelectableTreeNode | undefined): void {
        this.selection.selectNode(node);
    }

    get onExpansionChanged() {
        return this.expansion.onExpansionChanged;
    }

    async expandNode(raw?: Readonly<IExpandableTreeNode>): Promise<boolean> {
        const node = raw || this.selectedNode;
        if (IExpandableTreeNode.is(node)) {
            return await this.expansion.expandNode(node);
        }
        return false;
    }

    async collapseNode(raw?: Readonly<IExpandableTreeNode>): Promise<boolean> {
        const node = raw || this.selectedNode;
        if (IExpandableTreeNode.is(node)) {
            return await this.expansion.collapseNode(node);
        }
        return false;
    }

    async toggleNodeExpansion(raw?: Readonly<IExpandableTreeNode>): Promise<void> {
        const node = raw || this.selectedNode;
        if (IExpandableTreeNode.is(node)) {
            await this.expansion.toggleNodeExpansion(node);
        }
    }

    selectPrevNode(): void {
        const node = this.selectedNode;
        const iterator = this.createBackwardIterator(node);
        this.selectNextVisibleNode(iterator);
    }

    selectNextNode(): void {
        const node = this.selectedNode;
        const iterator = this.createIterator(node);
        this.selectNextVisibleNode(iterator);
    }

    protected selectNextVisibleNode(iterator: ITreeNodeIterator): void {
        let result = iterator.next();
        while (!result.done && !ISelectableTreeNode.isVisible(result.value)) {
            result = iterator.next();
        }
        const node = result.value;
        if (ISelectableTreeNode.isVisible(node)) {
            this.selectNode(node);
        }
    }

    protected createBackwardIterator(node: ITreeNode | undefined): ITreeNodeIterator {
        return new BackwardTreeNodeIterator(node, {
            pruneCollapsed: true
        });
    }

    protected createIterator(node: ITreeNode | undefined): ITreeNodeIterator {
        return new TreeNodeIterator(node, {
            pruneCollapsed: true
        });
    }

    openNode(raw?: ITreeNode | undefined): void {
        const node = raw || this.selectedNode;
        if (node) {
            this.doOpenNode(node);
            this.onOpenNodeEmitter.fire(node);
        }
    }

    protected doOpenNode(node: ITreeNode): void {
        if (IExpandableTreeNode.is(node)) {
            this.toggleNodeExpansion(node);
        }
    }

    selectParent(): void {
        const node = this.selectedNode;
        const parent = ISelectableTreeNode.getVisibleParent(node);
        if (parent) {
            this.selectNode(parent);
        }
    }

    async navigateTo(node: ITreeNode | undefined): Promise<void> {
        if (node) {
            this.navigation.push(node);
            await this.doNavigate(node);
        }
    }

    canNavigateForward(): boolean {
        return !!this.navigation.next;
    }

    canNavigateBackward(): boolean {
        return !!this.navigation.prev;
    }

    async navigateForward(): Promise<void> {
        const node = this.navigation.advance();
        if (node) {
            await this.doNavigate(node);
        }
    }

    async navigateBackward(): Promise<void> {
        const node = this.navigation.retreat();
        if (node) {
            await this.doNavigate(node);
        }
    }

    protected async doNavigate(node: ITreeNode): Promise<void> {
        this.tree.root = node;
        if (IExpandableTreeNode.is(node)) {
            await this.expandNode(node);
        }
        if (ISelectableTreeNode.is(node)) {
            this.selectNode(node);
        }
    }

}

/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { Tree } from './tree';
import { DepthFirstTreeIterator } from './tree-iterator';
import { TreeSelection, SelectableTreeNode } from './tree-selection';

/**
 * Class for representing and managing the selection state of a tree.
 */
export class TreeSelectionState {

    constructor(protected tree: Tree, protected readonly selectionStack: ReadonlyArray<TreeSelection> = []) {
    }

    nextState(selection: TreeSelection): TreeSelectionState {
        const { node, type } = {
            type: TreeSelection.SelectionType.DEFAULT,
            ...selection
        };
        switch (type) {
            case TreeSelection.SelectionType.DEFAULT: return this.handleDefault(this, node);
            case TreeSelection.SelectionType.TOGGLE: return this.handleToggle(this, node);
            case TreeSelection.SelectionType.RANGE: return this.handleRange(this, node);
            default: throw new Error(`Unexpected tree selection type: ${type}.`);
        }
    }

    selectedNodes(): ReadonlyArray<SelectableTreeNode> {
        const copy = this.checkNoDefaultSelection(this.selectionStack);
        const nodes: SelectableTreeNode[] = [];
        let lastSelection: { node: SelectableTreeNode, type: TreeSelection.SelectionType | undefined } | undefined;
        for (let i = 0; i < copy.length; i++) {
            const { node, type } = copy[i];
            if (type === TreeSelection.SelectionType.RANGE) {
                if (lastSelection && lastSelection.type === TreeSelection.SelectionType.TOGGLE) {
                    // We pop the item we saved to be able to calculate the range. See #handleRange.
                    nodes.pop();
                }
                nodes.push(...this.selectionRange(lastSelection ? lastSelection.node : undefined, node));
            } else if (type === TreeSelection.SelectionType.TOGGLE) {
                nodes.push(node);
            }
            lastSelection = { node, type };
        }
        return Array.from(new Set(nodes.reverse()).keys());
    }

    protected handleReset(state: TreeSelectionState): TreeSelectionState {
        return new TreeSelectionState(this.tree);
    }

    protected handleDefault(state: TreeSelectionState, selectedNode: Readonly<SelectableTreeNode>): TreeSelectionState {
        const { tree } = state;
        // Internally, We replace all `DEFAULT` types with toggle.
        return new TreeSelectionState(tree, [{
            node: selectedNode,
            type: TreeSelection.SelectionType.TOGGLE
        }]);
    }

    protected handleToggle(state: TreeSelectionState, selectedNode: Readonly<SelectableTreeNode>): TreeSelectionState {
        const { tree, selectionStack } = state;
        const copy = this.checkNoDefaultSelection(selectionStack).slice();

        // Do not toggle (in this case; remove) the selection state when only one node is selected.
        if (copy.length === 1) {
            const { node, type } = copy[0];
            if (type === TreeSelection.SelectionType.TOGGLE && node === selectedNode) {
                return this;
            }
        }

        // First, we check whether the toggle selection intersects any ranges.
        // This can happen only when removing an individual selection.
        // If so, we split the range selection into individual toggle selections.
        let lastSelection: SelectableTreeNode | undefined;
        for (let i = copy.length - 1; i >= 0; i--) {
            lastSelection = (copy[i - 1] || {}).node;
            const { node, type } = copy[i];
            if (type === TreeSelection.SelectionType.RANGE) {
                const range = this.selectionRange(lastSelection, node);
                const index = range.indexOf(selectedNode);
                if (index !== -1) {
                    range.splice(index, 1);
                    const rangeSubstitute = range.map(n => ({ node: n, type: TreeSelection.SelectionType.TOGGLE }));
                    // Remove the first item, that is the border. We do not want to include twice.
                    rangeSubstitute.shift();
                    copy.splice(i, 1, ...rangeSubstitute);
                    return new TreeSelectionState(tree, [...copy]);
                }
            }
        }

        const toggle = { node: selectedNode, type: TreeSelection.SelectionType.TOGGLE };
        const toRemove: number[] = [];
        for (let i = copy.length - 1; i >= 0; i--) {
            // We try to merge toggle selections. So that when a node has been selected twice with the toggle selection type, we remove both.
            // We do this until we see another range selection in the stack.
            const selection = copy[i];
            const { node, type } = selection;
            if (type === TreeSelection.SelectionType.RANGE) {
                break;
            }
            if (node === selectedNode) {
                toRemove.push(i);
            }
        }

        toRemove.forEach(index => copy.splice(index, 1));
        if (toRemove.length > 0) {
            // If we merged selections together, we can omit the current selection.
            return new TreeSelectionState(tree, [...copy]);
        } else {
            return new TreeSelectionState(tree, [...copy, toggle]);
        }
    }

    protected handleRange(state: TreeSelectionState, selectedNode: Readonly<SelectableTreeNode>): TreeSelectionState {
        const { tree, selectionStack } = state;
        const copy = this.checkNoDefaultSelection(selectionStack).slice();
        const range = { node: selectedNode, type: TreeSelection.SelectionType.RANGE };
        const lastSelection = (copy[copy.length - 1] || {}).node;
        const toRemove: number[] = [];
        for (let i = copy.length - 1; i >= 0; i--) {
            // We try to merge all the toggle selections into the range. So that when a range contains a toggle selection, we remove the toggle selection.
            // We do this until we see another range selection in the stack. Expect when the last selection was a range as well.
            // If the most recent selection was a range, we are just trying to modify that right now.
            const selection = copy[i];
            const { node, type } = selection;
            if (type === TreeSelection.SelectionType.RANGE) {
                // When trying to modify the most recent range selection.
                if (i === copy.length - 1) {
                    copy.pop();
                }
                break;
            }
            const index = this.selectionRange(lastSelection, range.node).indexOf(node);
            if (index !== -1) {
                toRemove.push(i);
            }
        }
        // We never drop the very first item, otherwise we lose the range start information. A range selection must come after a toggle.
        toRemove.shift();
        toRemove.forEach(index => copy.splice(index, 1));
        return new TreeSelectionState(tree, [...copy, range]);
    }

    /**
     * Returns with an array of items representing the selection range. Both the `fromNode` and the `toNode` are inclusive.
     */
    protected selectionRange(fromNode: Readonly<SelectableTreeNode> | undefined, toNode: Readonly<SelectableTreeNode>): Readonly<SelectableTreeNode>[] {
        if (fromNode === undefined) {
            return [];
        }
        if (toNode === fromNode) {
            return [toNode];
        }
        const { root } = this.tree;
        if (root === undefined) {
            return [];
        }
        const to = this.tree.validateNode(toNode);
        if (to === undefined) {
            return [];
        }
        const from = this.tree.validateNode(fromNode);
        if (from === undefined) {
            return [];
        }
        let started = false;
        let finished = false;
        const range = [];
        for (const node of new DepthFirstTreeIterator(root, { pruneCollapsed: true })) {
            if (finished) {
                break;
            }
            // Only collect items which are between (inclusive) the `from` node and the `to` node.
            if (node === from || node === to) {
                if (started) {
                    finished = true;
                } else {
                    started = true;
                }
            }
            if (started) {
                range.push(node);
            }
        }

        // We need to reverse the selection range order.
        if (range.indexOf(from) > range.indexOf(to)) {
            range.reverse();
        }
        return range.filter(SelectableTreeNode.is);
    }

    /**
     * Checks whether the argument contains any `DEFAULT` tree selection type. If yes, throws an error, otherwise returns with a reference the argument.
     */
    protected checkNoDefaultSelection(selections: ReadonlyArray<TreeSelection>): ReadonlyArray<TreeSelection> {
        if (selections.some(selection => selection.type === undefined || selection.type === TreeSelection.SelectionType.DEFAULT)) {
            throw new Error(`Unexpected DEFAULT selection type. [${selections.map(selection => `ID: ${selection.node.id} | ${selection.type}`).join(', ')}]`);
        }
        return selections;
    }

}

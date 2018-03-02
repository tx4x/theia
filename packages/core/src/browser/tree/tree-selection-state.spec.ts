/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { expect } from 'chai';
import { Container } from 'inversify';
import { Tree, TreeImpl } from './tree';
import { MockTreeModel } from './test/mock-tree-model';
import { TreeSelectionState } from './tree-selection-state';
import { TreeNavigationService } from './tree-navigation';
import { TreeModel, TreeModelImpl } from './tree-model';
import { TreeExpansionService, TreeExpansionServiceImpl } from './tree-expansion';
import { TreeSelection, TreeSelectionService, TreeSelectionServiceImpl, SelectableTreeNode } from './tree-selection';

namespace TreeSelectionState {

    export interface Assert {
        readonly nextState: (type: 'default' | 'toggle' | 'range', nodeId: string, expectedIds?: string[]) => Assert;
    }

}

describe('tree-selection-state', () => {

    const model = createTreeModel();
    const findNode = (nodeId: string) => model.getNode(nodeId) as (SelectableTreeNode);

    beforeEach(() => {
        model.root = MockTreeModel.MOCK_ROOT();
        // tslint:disable-next-line:no-unused-expression
        expect(model.selectedNodes).to.be.empty;
    });

    it('01 - selection state', () => {
        newState()
            .nextState('toggle', '1.1', [
                '1.1'
            ])
            .nextState('toggle', '1.1.2', [
                '1.1.2', '1.1'
            ])
            .nextState('toggle', '1.2.1.1', [
                '1.2.1.1', '1.1.2', '1.1'
            ])
            .nextState('toggle', '1.2', [
                '1.2', '1.2.1.1', '1.1.2', '1.1'
            ])
            .nextState('range', '1.3', [
                '1.3', '1.2.3', '1.2.2', '1.2.1.2', '1.2.1.1', '1.2.1', '1.2', '1.1.2', '1.1'
            ]);
    });

    it('02 - selection state', () => {
        newState()
            .nextState('toggle', '1.1', [
                '1.1'
            ])
            .nextState('toggle', '1.2.1.1', [
                '1.2.1.1', '1.1'
            ])
            .nextState('range', '1.2.3', [
                '1.2.3', '1.2.2', '1.2.1.2', '1.2.1.1', '1.1'
            ])
            .nextState('range', '1.2.1.2', [
                '1.2.1.2', '1.2.1.1', '1.1'
            ]);
    });

    it('03 - selection state', () => {
        newState()
            .nextState('toggle', '1.1', [
                '1.1'
            ])
            .nextState('toggle', '1.2.1.1', [
                '1.2.1.1', '1.1'
            ])
            .nextState('range', '1.2.3', [
                '1.2.3', '1.2.2', '1.2.1.2', '1.2.1.1', '1.1'
            ])
            .nextState('range', '1.2.1', [
                '1.2.1', '1.2.1.1', '1.1'
            ]);
    });

    it('04 - selection state', () => {
        newState()
            .nextState('toggle', '1.1', [
                '1.1'
            ])
            .nextState('toggle', '1.2.1.1', [
                '1.2.1.1', '1.1'
            ])
            .nextState('toggle', '1.1', [
                '1.2.1.1'
            ]);
    });

    it('05 - selection state', () => {
        newState()
            .nextState('toggle', '1.1', [
                '1.1'
            ])
            .nextState('toggle', '1.1.2', [
                '1.1.2', '1.1'
            ])
            .nextState('toggle', '1.2.1.2', [
                '1.2.1.2', '1.1.2', '1.1'
            ])
            .nextState('range', '1.2.3', [
                '1.2.3', '1.2.2', '1.2.1.2', '1.1.2', '1.1'
            ])
            .nextState('toggle', '1.2.2', [
                '1.2.3', '1.2.1.2', '1.1.2', '1.1'
            ]);
    });

    it('06 - selection state', () => {
        newState()
            .nextState('toggle', '1.2.2', [
                '1.2.2'
            ])
            .nextState('range', '1.2.1', [
                '1.2.1', '1.2.1.1', '1.2.1.2', '1.2.2'
            ])
            .nextState('range', '1.2.3', [
                '1.2.3', '1.2.2'
            ])
            .nextState('range', '1.1', [
                '1.1', '1.1.1', '1.1.2', '1.2', '1.2.1', '1.2.1.1', '1.2.1.2', '1.2.2'
            ])
            .nextState('toggle', '1.1.2', [
                '1.1', '1.1.1', '1.2', '1.2.1', '1.2.1.1', '1.2.1.2', '1.2.2'
            ])
            .nextState('toggle', '1.2', [
                '1.1', '1.1.1', '1.2.1', '1.2.1.1', '1.2.1.2', '1.2.2'
            ])
            .nextState('toggle', '1.2.1', [
                '1.1', '1.1.1', '1.2.1.1', '1.2.1.2', '1.2.2'
            ])
            .nextState('toggle', '1.2.1.1', [
                '1.1', '1.1.1', '1.2.1.2', '1.2.2'
            ])
            // VSCode would expect: [1.1, 1.1.1, 1.2, 1.2.1, 1.2.1.1, 1.2.1.2, 1.2.2]
            // They keep the focus on a node even if unselecting it with Ctrl/Cmd.
            .nextState('range', '1.2', [
                '1.2', '1.1.2', '1.1.1', '1.1', '1.2.1.2', '1.2.2'
            ]);
    });

    it('07 - selection state', () => {
        newState()
            .nextState('toggle', '1.2.2', [
                '1.2.2'
            ])
            .nextState('range', '1.1.1', [
                '1.1.1', '1.1.2', '1.2', '1.2.1', '1.2.1.1', '1.2.1.2', '1.2.2'
            ])
            .nextState('toggle', '1.1.2', [
                '1.1.1', '1.2', '1.2.1', '1.2.1.1', '1.2.1.2', '1.2.2'
            ])
            .nextState('range', '1.2.3', [
                '1.2.3', '1.2.2', '1.2.1.2', '1.2.1.1', '1.2.1', '1.2', '1.1.2', '1.1.1'
            ]);
    });

    it('08 - selection state', () => {
        newState()
            .nextState('toggle', '1.2.2', [
                '1.2.2'
            ])
            .nextState('toggle', '1.2.1.1', [
                '1.2.1.1', '1.2.2'
            ])
            .nextState('range', '1.1.1', [
                '1.1.1', '1.1.2', '1.2', '1.2.1', '1.2.1.1', '1.2.2'
            ])
            .nextState('range', '1.2.3', [
                '1.2.3', '1.2.2', '1.2.1.2', '1.2.1.1'
            ]);
    });

    it('09 - selection state', () => {
        newState()
            .nextState('toggle', '1.2.3', [
                '1.2.3'
            ])
            .nextState('range', '1.1.1', [
                '1.1.1', '1.1.2', '1.2', '1.2.1', '1.2.1.1', '1.2.1.2', '1.2.2', '1.2.3'
            ])
            .nextState('toggle', '1.2.1.1', [
                '1.1.1', '1.1.2', '1.2', '1.2.1', '1.2.1.2', '1.2.2', '1.2.3'
            ])
            .nextState('toggle', '1.2.1.2', [
                '1.1.1', '1.1.2', '1.2', '1.2.1', '1.2.2', '1.2.3'
            ])
            .nextState('toggle', '1.2.1', [
                '1.1.1', '1.1.2', '1.2', '1.2.2', '1.2.3'
            ])
            .nextState('toggle', '1.2', [
                '1.1.1', '1.1.2', '1.2.2', '1.2.3'
            ])
            // VSCode would expect: [1.1, 1.1.1, 1.1.2, 1.2, 1.2.2, 1.2.3]
            // They keep the focus on a node even if unselecting it with Ctrl/Cmd.
            .nextState('range', '1.1', [
                '1.1', '1.1.1', '1.1.2', '1.2.2', '1.2.3'
            ]);
    });

    it('10 - selection state', () => {
        newState()
            .nextState('toggle', '1', [
                '1'
            ])
            .nextState('toggle', '1.1', [
                '1.1', '1'
            ])
            .nextState('default', '1.2', [
                '1.2'
            ]);
    });

    it('11 - selection state', () => {
        newState()
            .nextState('toggle', '1', [
                '1'
            ])
            .nextState('toggle', '1', [
                '1'
            ]);
    });

    it('12 - selection state', () => {
        newState()
            .nextState('toggle', '1.1', [
                '1.1'
            ])
            .nextState('range', '1', [
                '1', '1.1'
            ])
            .nextState('range', '1.1', [
                '1.1'
            ])
            .nextState('range', '1.1.1', [
                '1.1.1', '1.1'
            ])
            .nextState('range', '1.1', [
                '1.1'
            ])
            .nextState('range', '1', [
                '1', '1.1'
            ]);
    });

    function newState(): TreeSelectionState.Assert {
        return nextState(new TreeSelectionState(model));
    }

    function nextState(state: TreeSelectionState): TreeSelectionState.Assert {
        return {
            nextState: (nextType, nextId, expectedIds) => {
                const node = findNode(nextId);
                const type = ((t: 'default' | 'toggle' | 'range') => {
                    switch (t) {
                        case 'default': return TreeSelection.SelectionType.DEFAULT;
                        case 'toggle': return TreeSelection.SelectionType.TOGGLE;
                        case 'range': return TreeSelection.SelectionType.RANGE;
                        default: throw new Error(`Unexpected selection type: ${t}.`);
                    }
                })(nextType);
                const next = state.nextState({ node, type });
                if (!!expectedIds) {
                    expect(next.selectedNodes().map(n => n.id)).to.be.deep.equal(expectedIds);
                }
                return nextState(next);
            }
        };
    }

    function createTreeModel(): TreeModel {
        const container = new Container({ defaultScope: 'Singleton' });
        container.bind(TreeImpl).toSelf();
        container.bind(Tree).toService(TreeImpl);
        container.bind(TreeSelectionServiceImpl).toSelf();
        container.bind(TreeSelectionService).toService(TreeSelectionServiceImpl);
        container.bind(TreeExpansionServiceImpl).toSelf();
        container.bind(TreeExpansionService).toService(TreeExpansionServiceImpl);
        container.bind(TreeNavigationService).toSelf();
        container.bind(TreeModelImpl).toSelf();
        container.bind(TreeModel).toService(TreeModelImpl);
        return container.get(TreeModel);
    }

});

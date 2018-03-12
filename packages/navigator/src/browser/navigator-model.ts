/*
 * Copyright (C) 2017 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from "inversify";
import { OpenerService, open, ITreeNode, IExpandableTreeNode } from "@theia/core/lib/browser";
import { FileNode, FileTreeModel, FileTreeServices } from "@theia/filesystem/lib/browser";
import { FileNavigatorTree } from "./navigator-tree";
import URI from "@theia/core/lib/common/uri";

@injectable()
export class FileNavigatorServices extends FileTreeServices {
    @inject(OpenerService) readonly openerService: OpenerService;
}

@injectable()
export class FileNavigatorModel extends FileTreeModel {

    protected readonly openerService: OpenerService;

    constructor(
        @inject(FileNavigatorTree) protected readonly tree: FileNavigatorTree,
        @inject(FileNavigatorServices) services: FileNavigatorServices
    ) {
        super(tree, services);
    }

    protected doOpenNode(node: ITreeNode): void {
        if (FileNode.is(node)) {
            open(this.openerService, node.uri);
        } else {
            super.doOpenNode(node);
        }
    }

    /**
     * Reveals node in the navigator by given file uri.
     *
     * @param targetFileUri uri to file which should be revealed in the navigator
     * @returns file tree node if the file with given uri was revealed, undefined otherwise
     */
    async revealFile(targetFileUri: URI): Promise<ITreeNode | undefined> {
        const navigatorNodeId = targetFileUri.toString();
        let node = this.getNode(navigatorNodeId);

        // success stop condition
        // we have to reach workspace root because expanded node could be inside collapsed one
        if (this.root === node) {
            if (IExpandableTreeNode.is(node)) {
                if (!node.expanded) {
                    await this.expandNode(node);
                }
                return node;
            }
            // shouldn't happen, root node is always directory, i.e. expandable
            return undefined;
        }

        // fail stop condition
        if (targetFileUri.path.isRoot) {
            // file system root is reached but workspace root wasn't found, it means that
            // given uri is not in workspace root folder or points to not existing file.
            return undefined;
        }

        if (await this.revealFile(targetFileUri.parent)) {
            if (node === undefined) {
                // get node if it wasn't mounted into navigator tree before expansion
                node = this.getNode(navigatorNodeId);
            }
            if (IExpandableTreeNode.is(node) && !node.expanded) {
                await this.expandNode(node);
            }
            return node;
        }
        return undefined;
    }

}

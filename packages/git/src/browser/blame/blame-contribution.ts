/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from 'inversify';
import { FrontendApplicationContribution, FrontendApplication, KeybindingContribution, KeybindingRegistry } from "@theia/core/lib/browser";
import { CommandContribution, CommandRegistry, Command, MenuContribution, MenuModelRegistry, Disposable, DisposableCollection } from '@theia/core/lib/common';
import { BlameDecorator } from './blame-decorator';
import { EDITOR_CONTEXT_MENU, EditorManager, EditorKeybindingContexts, EditorWidget } from '@theia/editor/lib/browser';
import { BlameManager } from './blame-manager';
import URI from '@theia/core/lib/common/uri';

export namespace BlameCommands {
    export const SHOW_GIT_ANNOTATIONS: Command = {
        id: 'git.editor.show.annotations',
        label: 'Show Git Annotations'
    };
    export const CLEAR_GIT_ANNOTATIONS: Command = {
        id: 'git.editor.clear.annotations'
    };
}

@injectable()
export class BlameContribution implements FrontendApplicationContribution, CommandContribution, KeybindingContribution, MenuContribution {

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    @inject(BlameDecorator)
    protected readonly decorator: BlameDecorator;

    @inject(BlameManager)
    protected readonly blameManager: BlameManager;

    onStart(app: FrontendApplication): void {
    }

    registerCommands(commands: CommandRegistry): void {
        commands.registerCommand(BlameCommands.SHOW_GIT_ANNOTATIONS, {
            execute: () => {
                const editor = this.currentEditor;
                if (editor) {
                    this.showBlame(editor);
                }
            },
            isVisible: () =>
                !!this.currentEditor,
            isEnabled: () => {
                const editor = this.currentEditor;
                return !!editor && this.isBlameable(editor.editor.uri);
            }
        });
        commands.registerCommand(BlameCommands.CLEAR_GIT_ANNOTATIONS, {
            execute: () => {
                const editor = this.currentEditor;
                if (editor) {
                    this.clearBlame(editor.editor.uri);
                }
            },
            isVisible: () =>
                !!this.currentEditor,
            isEnabled: () => {
                const editor = this.currentEditor;
                return !!editor && this.appliedDecorations.has(editor.editor.uri.toString());
            }
        });
    }

    protected get currentEditor(): EditorWidget | undefined {
        const editor = this.editorManager.currentEditor;
        return editor;
    }

    protected isBlameable(uri: string | URI): boolean {
        return this.blameManager.isBlameable(uri.toString());
    }

    protected appliedDecorations = new Map<string, Disposable>();

    protected async showBlame(editorWidget: EditorWidget) {
        const uri = editorWidget.editor.uri;
        if (editorWidget.editor.document.dirty) {
            await editorWidget.editor.document.save();
        }
        const blame = await this.blameManager.getBlame(uri.toString());
        if (blame) {
            const toDispose = new DisposableCollection();
            this.appliedDecorations.set(uri.toString(), toDispose);
            const editor = editorWidget.editor;
            toDispose.push(this.decorator.decorate(blame, editor, editor.cursor.line));
            toDispose.push(editor.onDocumentContentChanged(() => this.clearBlame(uri)));
            toDispose.push(editor.onCursorPositionChanged(position =>
                this.decorator.decorate(blame, editor, position.line)
            ));
            editorWidget.disposed.connect(() => this.clearBlame(uri));
        }
    }

    protected clearBlame(uri: string | URI) {
        const decorations = this.appliedDecorations.get(uri.toString());
        if (decorations) {
            this.appliedDecorations.delete(uri.toString());
            decorations.dispose();
        }
    }

    registerMenus(menus: MenuModelRegistry): void {
        menus.registerMenuAction([...EDITOR_CONTEXT_MENU, '3_git'], {
            commandId: BlameCommands.SHOW_GIT_ANNOTATIONS.id,
            label: BlameCommands.SHOW_GIT_ANNOTATIONS.label
        });
    }

    registerKeybindings(keybindings: KeybindingRegistry): void {
        keybindings.registerKeybinding({
            command: BlameCommands.SHOW_GIT_ANNOTATIONS.id,
            context: EditorKeybindingContexts.editorTextFocus,
            keybinding: 'alt+b'
        });
        keybindings.registerKeybinding({
            command: BlameCommands.CLEAR_GIT_ANNOTATIONS.id,
            context: EditorKeybindingContexts.editorTextFocus,
            keybinding: 'esc'
        });
    }

}

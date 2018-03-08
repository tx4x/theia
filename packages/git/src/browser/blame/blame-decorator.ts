/*
 * Copyright (C) 2018 TypeFox and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { inject, injectable } from 'inversify';
import {
    EditorManager, EditorDecorationsService, TextEditor, EditorDecoration, EditorDecorationOptions, Range, Position, EditorDecorationStyle
} from '@theia/editor/lib/browser';
import { GitFileBlame, Commit } from '../../common';
import { Disposable, DisposableCollection } from '@theia/core';
import * as moment from 'moment';

export class AppliedDecorations implements Disposable {
    readonly toDispose = new DisposableCollection();
    readonly previousDecorations: string[] = [];

    dispose(): void {
        this.toDispose.dispose();
    }
}

@injectable()
export class BlameDecorator {

    @inject(EditorDecorationsService)
    protected readonly editorDecorationsService: EditorDecorationsService;

    @inject(EditorManager)
    protected readonly editorManager: EditorManager;

    constructor(
    ) { }

    protected applications = new Map<string, AppliedDecorations>();

    decorate(blame: GitFileBlame, editor: TextEditor, highlightLine: number): Disposable {
        const uri = editor.uri.toString();
        let applications = this.applications.get(uri);
        if (!applications) {
            const that = applications = new AppliedDecorations();
            this.applications.set(uri, applications);
            applications.toDispose.push(Disposable.create(() => {
                this.applications.delete(uri);
            }));
            applications.toDispose.push(Disposable.create(() => {
                editor.deltaDecorations({ uri, oldDecorations: that.previousDecorations, newDecorations: [] });
            }));
        }
        const blameDecorations = this.toDecorations(blame, highlightLine);
        applications.toDispose.pushAll(blameDecorations.styles);
        const newDecorations = blameDecorations.editorDecorations;
        const oldDecorations = applications.previousDecorations;
        const appliedDecorations = editor.deltaDecorations({ uri, oldDecorations, newDecorations });
        applications.previousDecorations.length = 0;
        applications.previousDecorations.push(...appliedDecorations);
        return applications;
    }

    protected toDecorations(blame: GitFileBlame, highlightLine: number): BlameDecorations {
        const hoverMessages = new Map<string, string>();
        const beforeContentStyles = new Map<string, EditorDecorationStyle>();
        const commits = blame.commits;
        for (const commit of commits) {
            const sha = commit.sha;
            const commitTime = moment(commit.author.timestamp);
            const heat = this.getHeatColor(commitTime);
            const content = this.formatContentLine(commit, commitTime);
            const short = sha.substr(0, 7);
            const selector = 'git' + short + '::before';
            beforeContentStyles.set(sha, new EditorDecorationStyle(selector, style => {
                EditorDecorationStyle.copyStyle(BlameDecorator.defaultGutterStyles, style);
                style.content = `'${content}'`;
                style.borderColor = heat;
            }));
            const hoverMessage = this.formatHover(commit);
            hoverMessages.set(sha, hoverMessage);
        }
        const commitLines = blame.lines;
        const highlightedCommitLine = commitLines.find(c => c.line === highlightLine);
        const highlightedSha = highlightedCommitLine ? highlightedCommitLine.sha : '';
        let previousLineSha = '';
        const editorDecorations: EditorDecoration[] = [];

        for (const commitLine of commitLines) {
            const { line, sha } = commitLine;
            const beforeContentClassName = beforeContentStyles.get(sha)!.className;
            const hoverMessage = hoverMessages.get(sha)!;
            const options = <EditorDecorationOptions>{
                beforeContentClassName,
                hoverMessage,
            };
            if (sha === highlightedSha) {
                options.beforeContentClassName += ' ' + BlameDecorator.highlightStyle.className;
            }
            if (sha === previousLineSha) {
                options.beforeContentClassName += ' ' + BlameDecorator.continuationStyle.className;
            }
            previousLineSha = sha;
            const range = Range.create(Position.create(line, 0), Position.create(line, 0));
            editorDecorations.push(<EditorDecoration>{ range, options });
        }
        const styles = [...beforeContentStyles.values()];
        return { editorDecorations, styles };
    }

    protected formatHover(commit: Commit): string {
        const date = new Date(commit.author.timestamp);
        return `
        ${commit.sha}

        ${commit.author.name}, ${date.toString()}

        ${commit.summary}`;
    }

    protected formatContentLine(commit: Commit, commitTime: moment.Moment): string {
        const when = commitTime.fromNow();
        const contentWidth = BlameDecorator.maxWidth - when.length - 2;
        let content = commit.summary.substring(0, contentWidth + 1);
        content.replace('\n', '↩︎');
        if (content.length > contentWidth) {
            let cropAt = content.lastIndexOf(' ', contentWidth - 4);
            if (cropAt < contentWidth / 2) {
                cropAt = contentWidth - 3;
            }
            content = content.substring(0, cropAt) + '...';
        }
        if (content.length < contentWidth) {
            content = content + '\u2007'.repeat(contentWidth - content.length); // fill up with blanks
        }
        return `${content} ${when}`;
    }

    protected now = moment();
    protected getHeatColor(commitTime: moment.Moment): string {
        const daysFromNow = this.now.diff(commitTime, 'days');
        let heat = 900;
        if (daysFromNow <= 1) {
            heat = 50;
        } else if (daysFromNow <= 2) {
            heat = 100;
        } else if (daysFromNow <= 3) {
            heat = 200;
        } else if (daysFromNow <= 7) {
            heat = 300;
        } else if (daysFromNow <= 14) {
            heat = 400;
        } else if (daysFromNow <= 30) {
            heat = 500;
        } else if (daysFromNow <= 180) {
            heat = 600;
        } else if (daysFromNow <= 365) {
            heat = 700;
        } else if (daysFromNow <= 720) {
            heat = 800;
        }
        return `var(--md-deep-orange-${heat})`;
    }

}

export namespace BlameDecorator {

    export const maxWidth = 50; // character

    export const defaultGutterStyles = <CSSStyleDeclaration>{
        width: `${maxWidth}ch`,
        backgroundColor: 'var(--md-grey-100)',
        height: '100%',
        margin: '0 26px -1px 0',
        display: 'inline-block',
        borderLeft: `4px solid`,
        borderRight: `4px solid`,
    };

    export const continuationStyle = new EditorDecorationStyle('gitBlameContinuationLine::before', style => {
        style.content = `'\u2007'`; // blank
    });

    export const highlightStyle = new EditorDecorationStyle('gitBlameHighlight::before', style => {
        style.backgroundColor = 'var(--theia-accent-color3)';
    });

}

export interface BlameDecorations {
    editorDecorations: EditorDecoration[]
    styles: EditorDecorationStyle[]
}

/*
 * Copyright (C) 2018 Red Hat, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { interfaces } from "inversify";
import {
    createPreferenceProxy,
    PreferenceProxy,
    PreferenceService,
    PreferenceContribution,
    PreferenceSchema,
    PreferenceChangeEvent
} from '@theia/core/lib/browser/preferences';

export const navigatorPreferenceSchema: PreferenceSchema = {
    "type": "object",
    "properties": {
        "navigator.linkWithEditor": {
            "type": "boolean",
            "description": "Selects file under editing in the navigator.",
            "default": false
        }
    }
};

export interface NavigatorConfiguration {
    "navigator.linkWithEditor"?: boolean;
}

export type NavigatorPreferenceChange = PreferenceChangeEvent<NavigatorConfiguration>;

export const NavigatorPreferences = Symbol('NavigatorPreferences');
export type NavigatorPreferences = PreferenceProxy<NavigatorConfiguration>;

export function createNavigatorPreferences(preferences: PreferenceService): NavigatorPreferences {
    return createPreferenceProxy(preferences, navigatorPreferenceSchema);
}

export function bindNavigatorPreferences(bind: interfaces.Bind): void {
    bind(NavigatorPreferences).toDynamicValue(ctx => {
        const preferences = ctx.container.get<PreferenceService>(PreferenceService);
        return createNavigatorPreferences(preferences);
    }).inSingletonScope();

    bind(PreferenceContribution).toConstantValue({ schema: navigatorPreferenceSchema });
}

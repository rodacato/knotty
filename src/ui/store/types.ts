import type { StateCreator, StoreApi } from 'zustand'
import type { ExpertSlice } from './expert'
import type { SceneSlice } from './scene'
import type { SessionSlice } from './session'
import type { SettingsSlice } from './settings'

/** The whole store: each slice owns its fields and actions, and reads the others through `get`. */
export type Store = SessionSlice & ExpertSlice & SceneSlice & SettingsSlice

export type Set = StoreApi<Store>['setState']
export type Get = StoreApi<Store>['getState']

export type Slice<T> = StateCreator<Store, [], [], T>

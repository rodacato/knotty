/** The shortcut as the person's keyboard writes it. */
export const shortcutLabel = (platform: string = typeof navigator === 'undefined' ? '' : navigator.platform) => (/mac|iphone|ipad/i.test(platform) ? '⌘K' : 'Ctrl K')

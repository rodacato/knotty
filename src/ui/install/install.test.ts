import { describe, expect, it } from 'vitest'
import { installOffer } from './install'

const UA = {
  chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Mobile Safari/537.36',
  chromeMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Mobile/15E148 Safari/604.1',
  chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/141.0.0.0 Mobile/15E148 Safari/604.1',
  instagramIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 390.0.0',
  safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.5 Safari/605.1.15',
  oldSafariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Safari/605.1.15',
  firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:144.0) Gecko/20100101 Firefox/144.0',
  firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:144.0) Gecko/144.0 Firefox/144.0',
}

const offer = (userAgent: string, { standalone = false, prompt = false, touchPoints = 0 } = {}) => installOffer({ standalone, prompt, userAgent, touchPoints })

describe('installOffer', () => {
  it('uses the browser prompt when Chromium handed one over', () => {
    expect(offer(UA.chromeAndroid, { prompt: true, touchPoints: 5 })).toBe('prompt')
    expect(offer(UA.chromeMac, { prompt: true })).toBe('prompt')
  })

  it('explains the share sheet on Safari for iPhone and for iPad, which says it is a Mac', () => {
    expect(offer(UA.iphone, { touchPoints: 5 })).toBe('ios')
    expect(offer(UA.safariMac, { touchPoints: 5 })).toBe('ios')
  })

  it('explains «Agregar al Dock» on Safari for Mac from version 17', () => {
    expect(offer(UA.safariMac)).toBe('mac')
    expect(offer(UA.oldSafariMac)).toBeNull()
  })

  it('offers nothing once Knotty runs installed, even with a prompt at hand', () => {
    expect(offer(UA.chromeAndroid, { standalone: true, prompt: true })).toBeNull()
    expect(offer(UA.iphone, { standalone: true, touchPoints: 5 })).toBeNull()
  })

  it('offers nothing where the browser gave no prompt and Safari cannot be told how', () => {
    expect(offer(UA.firefox)).toBeNull()
    expect(offer(UA.firefoxAndroid, { touchPoints: 5 })).toBeNull()
    expect(offer(UA.chromeMac)).toBeNull()
    expect(offer(UA.chromeIphone, { touchPoints: 5 })).toBeNull()
    expect(offer(UA.instagramIphone, { touchPoints: 5 })).toBeNull()
  })
})

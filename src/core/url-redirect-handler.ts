import {
  ABsmartlySettings,
  ABsmartlyContext,
  ABsmartlyExperiment,
  Logger,
} from '../types'

export type RedirectMode = 'reverse-proxy' | 301 | 302 | 303 | 307 | 308

export interface URLRedirect {
  from: string
  to: string
  type: 'domain' | 'page' | 'pattern' | 'path-prefix'
  mode?: RedirectMode
  preservePath?: boolean
}

export interface URLRedirectConfig {
  redirects: URLRedirect[]
  urlFilter?: {
    include?: string[]
    exclude?: string[]
    matchType?: 'path' | 'full-url' | 'domain'
    mode?: 'simple' | 'regex'
  }
  controlBehavior?: 'redirect-same' | 'no-redirect'
}

export interface RedirectMatch {
  redirect: URLRedirect
  targetUrl: string
  experimentName: string
  variant: number
  isControl: boolean
  controlBehavior?: 'redirect-same' | 'no-redirect'
}

export interface URLRedirectHandlerOptions {
  settings: ABsmartlySettings
  logger: Logger
  variableName?: string
}

export class URLRedirectHandler {
  private variableName: string
  private logger: Logger
  private settings: ABsmartlySettings

  constructor(options: URLRedirectHandlerOptions) {
    this.settings = options.settings
    this.logger = options.logger
    this.variableName = options.variableName ?? '__url_redirect'
  }

  findRedirectMatch(
    url: string,
    context: ABsmartlyContext
  ): RedirectMatch | null {
    const contextData = context.data()

    if (!contextData?.experiments) {
      return null
    }

    let parsedUrl: URL
    try {
      parsedUrl = new URL(url)
    } catch {
      this.logger.error(`[URLRedirectHandler] Invalid URL: ${url}`)
      return null
    }

    for (const experiment of contextData.experiments) {
      const currentVariant = context.peek(experiment.name)

      if (currentVariant === undefined || currentVariant === null) {
        continue
      }

      const config = this.extractConfigForVariant(experiment, currentVariant)

      if (!config) {
        const matchingConfig = this.findMatchingVariantConfig(
          experiment,
          parsedUrl
        )
        if (matchingConfig) {
          this.logger.debug(
            `[URLRedirectHandler] Variant ${currentVariant} has no redirect config but URL matches another variant's redirect for ${experiment.name}`
          )
          return {
            redirect: {
              from: url,
              to: url,
              type: 'page',
              preservePath: true,
            },
            targetUrl: url,
            experimentName: experiment.name,
            variant: currentVariant,
            isControl: currentVariant === 0,
            controlBehavior: matchingConfig.controlBehavior,
          }
        }
        continue
      }

      if (
        config.urlFilter &&
        !this.matchesUrlFilter(config.urlFilter, parsedUrl)
      ) {
        this.logger.debug(
          `[URLRedirectHandler] URL doesn't match filter for ${experiment.name}`
        )
        continue
      }

      const match = this.findMatch(
        parsedUrl,
        config.redirects,
        experiment.name,
        currentVariant
      )

      if (match) {
        match.controlBehavior = config.controlBehavior
        this.logger.debug('[URLRedirectHandler] Found redirect match:', {
          experimentName: experiment.name,
          variant: currentVariant,
          from: match.redirect.from,
          to: match.redirect.to,
          targetUrl: match.targetUrl,
        })
        return match
      }
    }

    return null
  }

  private extractConfigForVariant(
    experiment: ABsmartlyExperiment,
    variant: number
  ): URLRedirectConfig | null {
    const variantData = experiment.variants?.[variant]
    if (!variantData?.config) {
      return null
    }

    try {
      const parsedConfig =
        typeof variantData.config === 'string'
          ? JSON.parse(variantData.config)
          : variantData.config

      const redirectData = parsedConfig?.[this.variableName]
      if (!redirectData) {
        return null
      }

      return this.parseConfig(redirectData)
    } catch (error) {
      this.logger.error(
        `[URLRedirectHandler] Failed to parse variant config:`,
        error
      )
      return null
    }
  }

  private findMatchingVariantConfig(
    experiment: ABsmartlyExperiment,
    parsedUrl: URL
  ): URLRedirectConfig | null {
    if (!experiment.variants) {
      return null
    }

    for (let i = 0; i < experiment.variants.length; i++) {
      const config = this.extractConfigForVariant(experiment, i)
      if (config) {
        const match = this.findMatch(
          parsedUrl,
          config.redirects,
          experiment.name,
          i
        )
        if (match) {
          return config
        }
      }
    }

    return null
  }

  private parseConfig(data: unknown): URLRedirectConfig | null {
    if (!data || typeof data !== 'object') {
      return null
    }

    const obj = data as Record<string, unknown>

    if (!Array.isArray(obj.redirects)) {
      return null
    }

    const redirects: URLRedirect[] = []

    for (const item of obj.redirects) {
      if (this.isValidRedirect(item)) {
        const redirect: URLRedirect = {
          from: item.from,
          to: item.to,
          preservePath: item.preservePath ?? true,
          type: item.type,
        }
        const parsedMode = this.parseRedirectMode(
          (item as unknown as Record<string, unknown>).mode
        )
        if (parsedMode !== undefined) {
          redirect.mode = parsedMode
        }
        redirects.push(redirect)
      }
    }

    if (redirects.length === 0) {
      return null
    }

    return {
      redirects,
      urlFilter: obj.urlFilter as URLRedirectConfig['urlFilter'],
      controlBehavior:
        (obj.controlBehavior as URLRedirectConfig['controlBehavior']) ||
        'no-redirect',
    }
  }

  private static VALID_REDIRECT_STATUS_CODES = new Set([
    301, 302, 303, 307, 308,
  ])

  private parseRedirectMode(value: unknown): RedirectMode | undefined {
    if (value === 'reverse-proxy') {
      return 'reverse-proxy'
    }
    if (
      typeof value === 'number' &&
      URLRedirectHandler.VALID_REDIRECT_STATUS_CODES.has(value)
    ) {
      return value as RedirectMode
    }
    if (typeof value === 'string') {
      const num = parseInt(value, 10)
      if (URLRedirectHandler.VALID_REDIRECT_STATUS_CODES.has(num)) {
        return num as RedirectMode
      }
    }
    return undefined
  }

  static resolveMode(
    redirect: URLRedirect,
    context: 'server' | 'client'
  ): RedirectMode {
    if (redirect.mode !== undefined) {
      if (context === 'client' && redirect.mode === 'reverse-proxy') {
        return 302
      }
      return redirect.mode
    }
    return context === 'server' ? 'reverse-proxy' : 302
  }

  private isValidRedirect(item: unknown): item is URLRedirect {
    if (!item || typeof item !== 'object') return false
    const obj = item as Record<string, unknown>
    return (
      typeof obj.from === 'string' &&
      typeof obj.to === 'string' &&
      (obj.type === 'domain' ||
        obj.type === 'page' ||
        obj.type === 'pattern' ||
        obj.type === 'path-prefix')
    )
  }

  private matchesUrlFilter(
    filter: URLRedirectConfig['urlFilter'],
    url: URL
  ): boolean {
    if (!filter) {
      return true
    }

    const matchType = filter.matchType || 'path'
    let urlPart: string

    switch (matchType) {
      case 'full-url':
        urlPart = url.href
        break
      case 'domain':
        urlPart = url.hostname
        break
      case 'path':
      default:
        urlPart = url.pathname
        break
    }

    if (filter.exclude) {
      for (const pattern of filter.exclude) {
        if (this.matchesPattern(pattern, urlPart, filter.mode || 'simple')) {
          return false
        }
      }
    }

    if (!filter.include || filter.include.length === 0) {
      return true
    }

    for (const pattern of filter.include) {
      if (this.matchesPattern(pattern, urlPart, filter.mode || 'simple')) {
        return true
      }
    }

    return false
  }

  private matchesPattern(
    pattern: string,
    value: string,
    mode: 'simple' | 'regex'
  ): boolean {
    if (mode === 'regex') {
      try {
        return new RegExp(pattern).test(value)
      } catch {
        return false
      }
    }

    const regexPattern = pattern
      .replace(/[.+^${}()|[\]\\]/g, '\\$&')
      .replace(/\*/g, '.*')
      .replace(/\?/g, '.')

    try {
      return new RegExp(`^${regexPattern}$`).test(value)
    } catch {
      return false
    }
  }

  private findMatch(
    currentUrl: URL,
    redirects: URLRedirect[],
    experimentName: string,
    variant: number
  ): RedirectMatch | null {
    for (const redirect of redirects) {
      const targetUrl = this.matchRedirect(currentUrl, redirect)
      if (targetUrl) {
        return {
          redirect,
          targetUrl,
          experimentName,
          variant,
          isControl: variant === 0,
        }
      }
    }

    return null
  }

  private matchRedirect(currentUrl: URL, redirect: URLRedirect): string | null {
    if (redirect.type === 'domain') {
      return this.matchDomainRedirect(currentUrl, redirect)
    }
    if (redirect.type === 'path-prefix') {
      return this.matchPathPrefixRedirect(currentUrl, redirect)
    }
    if (redirect.type === 'pattern') {
      return this.matchPatternRedirect(currentUrl, redirect)
    }
    return this.matchPageRedirect(currentUrl, redirect)
  }

  private matchDomainRedirect(
    currentUrl: URL,
    redirect: URLRedirect
  ): string | null {
    let fromUrl: URL
    try {
      fromUrl = new URL(redirect.from)
    } catch {
      return null
    }

    if (currentUrl.origin !== fromUrl.origin) {
      return null
    }

    let toUrl: URL
    try {
      toUrl = new URL(redirect.to)
    } catch {
      return null
    }

    if (redirect.preservePath !== false) {
      toUrl.pathname = currentUrl.pathname
      toUrl.search = currentUrl.search
      toUrl.hash = currentUrl.hash
    }

    return toUrl.toString()
  }

  private matchPathPrefixRedirect(
    currentUrl: URL,
    redirect: URLRedirect
  ): string | null {
    let fromUrl: URL
    try {
      fromUrl = new URL(redirect.from)
    } catch {
      return null
    }

    if (currentUrl.origin !== fromUrl.origin) {
      return null
    }

    let toUrl: URL
    try {
      toUrl = new URL(redirect.to)
    } catch {
      return null
    }

    const prefix = toUrl.pathname.replace(/\/$/, '')
    toUrl.pathname = prefix + currentUrl.pathname

    if (redirect.preservePath !== false) {
      toUrl.search = currentUrl.search
      toUrl.hash = currentUrl.hash
    }

    return toUrl.toString()
  }

  private matchPatternRedirect(
    currentUrl: URL,
    redirect: URLRedirect
  ): string | null {
    let fromUrl: URL
    try {
      fromUrl = new URL(redirect.from.replace(/\*/g, '__WILDCARD__'))
    } catch {
      return null
    }

    const fromOrigin = `${fromUrl.protocol}//${fromUrl.hostname}${fromUrl.port ? ':' + fromUrl.port : ''}`
    if (currentUrl.origin !== fromOrigin) {
      return null
    }

    const fromPathPattern = new URL(
      redirect.from.replace(/\*/g, '__WILDCARD__')
    ).pathname
    const captures = this.matchWildcardPattern(
      currentUrl.pathname,
      fromPathPattern
    )
    if (!captures) {
      return null
    }

    let toUrl: URL
    try {
      toUrl = new URL(
        redirect.to
          .replace(/\*/g, '__WILDCARD__')
          .replace(/\$\d+/g, '__WILDCARD__')
      )
    } catch {
      return null
    }

    const toOrigin = `${toUrl.protocol}//${toUrl.hostname}${toUrl.port ? ':' + toUrl.port : ''}`

    const hasIndexedRefs = /\$\d+/.test(redirect.to)
    let resultPath: string

    if (hasIndexedRefs) {
      const toPathRaw = new URL(redirect.to.replace(/\*/g, '__WILDCARD__'))
        .pathname
      resultPath = toPathRaw.replace(/\$(\d+)/g, (_, index) => {
        const i = parseInt(index, 10) - 1
        return i >= 0 && i < captures.length ? captures[i] : ''
      })
      resultPath = resultPath.replace(/__WILDCARD__/g, '')
    } else {
      const toPathTemplate = new URL(redirect.to.replace(/\*/g, '__WILDCARD__'))
        .pathname
      resultPath = toPathTemplate
      for (const capture of captures) {
        resultPath = resultPath.replace('__WILDCARD__', capture)
      }
      resultPath = resultPath.replace(/__WILDCARD__/g, '')
    }

    const result = new URL(toOrigin)
    result.pathname = resultPath

    if (redirect.preservePath !== false) {
      result.search = currentUrl.search
      result.hash = currentUrl.hash
    }

    return result.toString()
  }

  private matchWildcardPattern(
    input: string,
    pattern: string
  ): string[] | null {
    const parts = pattern.split('__WILDCARD__')

    if (parts.length === 1) {
      return input === pattern ? [] : null
    }

    const captures: string[] = []
    let remaining = input

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]

      if (i === 0) {
        if (!remaining.startsWith(part)) {
          return null
        }
        remaining = remaining.slice(part.length)
      } else if (i === parts.length - 1) {
        if (!remaining.endsWith(part)) {
          return null
        }
        captures.push(remaining.slice(0, remaining.length - part.length))
      } else {
        const idx = remaining.indexOf(part)
        if (idx === -1) {
          return null
        }
        captures.push(remaining.slice(0, idx))
        remaining = remaining.slice(idx + part.length)
      }
    }

    return captures
  }

  private matchPageRedirect(
    currentUrl: URL,
    redirect: URLRedirect
  ): string | null {
    let fromUrl: URL
    try {
      fromUrl = new URL(redirect.from)
    } catch {
      return null
    }

    if (
      currentUrl.origin !== fromUrl.origin ||
      currentUrl.pathname !== fromUrl.pathname
    ) {
      return null
    }

    let toUrl: URL
    try {
      toUrl = new URL(redirect.to)
    } catch {
      return null
    }

    if (redirect.preservePath !== false) {
      toUrl.search = currentUrl.search
      toUrl.hash = currentUrl.hash
    }

    return toUrl.toString()
  }
}

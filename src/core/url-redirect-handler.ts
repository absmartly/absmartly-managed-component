import {
  ABsmartlySettings,
  ABsmartlyContext,
  ABsmartlyExperiment,
  Logger,
} from '../types'

export interface URLRedirect {
  from: string
  to: string
  type: 'domain' | 'page'
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
        if (currentVariant === 0) {
          const anyConfig = this.getAnyVariantConfig(experiment)
          if (anyConfig?.controlBehavior === 'redirect-same') {
            this.logger.debug(
              `[URLRedirectHandler] Control variant with redirect-same behavior for ${experiment.name}`
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
              variant: 0,
              isControl: true,
            }
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

  private getAnyVariantConfig(
    experiment: ABsmartlyExperiment
  ): URLRedirectConfig | null {
    if (!experiment.variants) {
      return null
    }

    for (let i = 0; i < experiment.variants.length; i++) {
      const config = this.extractConfigForVariant(experiment, i)
      if (config) {
        return config
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
        redirects.push({
          from: item.from,
          to: item.to,
          preservePath: item.preservePath ?? true,
          type: item.type,
        })
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

  private isValidRedirect(item: unknown): item is URLRedirect {
    if (!item || typeof item !== 'object') return false
    const obj = item as Record<string, unknown>
    return (
      typeof obj.from === 'string' &&
      typeof obj.to === 'string' &&
      (obj.type === 'domain' || obj.type === 'page')
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

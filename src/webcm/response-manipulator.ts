import { ABSmartlySettings } from '../types'
import type { ExperimentData } from '../types'
import { HTMLProcessor } from '../core/html-processor'
import { Logger } from '../types'

// FetchedRequest is a WebCM-specific type not exported from @managed-components/types
// Define it locally as an extension of Response with url property
interface FetchedRequest extends Response {
  url: string
}

export class ResponseManipulator {
  constructor(
    private settings: ABSmartlySettings,
    private logger: Logger
  ) {}

  async manipulateResponse(
    request: FetchedRequest,
    experimentData: ExperimentData[]
  ): Promise<FetchedRequest> {
    try {
      this.logger.debug('Manipulating response HTML', {
        experimentsCount: experimentData.length,
        url: request.url,
      })

      // Only manipulate HTML responses
      const contentType = request.headers.get('content-type') || ''
      if (!contentType.includes('text/html')) {
        this.logger.debug('Skipping non-HTML response', { contentType })
        return request
      }

      // Get response body
      let html = await request.text()

      // Process HTML with Treatment tags and DOM changes (zero flicker!)
      const processor = new HTMLProcessor({
        settings: this.settings,
        logger: this.logger,
        useLinkedom: true, // WebCM uses linkedom for full CSS selector support
      })
      html = processor.processHTML(html, experimentData)

      // Inject experiment data for client-side tracking (optional)
      if (this.settings.INJECT_CLIENT_DATA) {
        html = this.injectExperimentData(html, experimentData)
      }

      // Create new response with modified HTML
      const modifiedResponse = new Response(html, {
        status: request.status,
        statusText: request.statusText,
        headers: request.headers,
      })

      // Create a FetchedRequest-compatible object that wraps the Response
      // We can't modify Response.url directly as it's read-only
      const result = {
        ...modifiedResponse,
        url: request.url,
        text: () => modifiedResponse.text(),
        json: () => modifiedResponse.json(),
        arrayBuffer: () => modifiedResponse.arrayBuffer(),
        blob: () => modifiedResponse.blob(),
        formData: () => modifiedResponse.formData(),
        clone: () => modifiedResponse.clone(),
        status: modifiedResponse.status,
        statusText: modifiedResponse.statusText,
        headers: modifiedResponse.headers,
        ok: modifiedResponse.ok,
        redirected: modifiedResponse.redirected,
        type: modifiedResponse.type,
        bodyUsed: modifiedResponse.bodyUsed,
        body: modifiedResponse.body,
      } as FetchedRequest

      this.logger.debug('Response manipulated successfully')

      return result
    } catch (error) {
      this.logger.error('Failed to manipulate response:', error)
      // Return original request on error (graceful degradation)
      return request
    }
  }

  private injectExperimentData(
    html: string,
    experimentData: ExperimentData[]
  ): string {
    // Inject experiment data as a script tag for client-side access
    const dataScript = `
<script id="absmartly-data" type="application/json">
${JSON.stringify({ experiments: experimentData })}
</script>
    `.trim()

    // Inject before </head> if possible, otherwise before </body>
    if (html.includes('</head>')) {
      return html.replace('</head>', `${dataScript}</head>`)
    } else if (html.includes('</body>')) {
      return html.replace('</body>', `${dataScript}</body>`)
    } else {
      // Append at the end if no head or body tags
      return html + dataScript
    }
  }

  shouldManipulate(url: string): boolean {
    // Check if URL should be manipulated based on settings
    const excludedPaths = this.settings.EXCLUDED_PATHS || []

    for (const path of excludedPaths) {
      if (url.includes(path)) {
        this.logger.debug('URL excluded from manipulation', { url, path })
        return false
      }
    }

    return true
  }
}

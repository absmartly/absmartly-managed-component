/**
 * Zaraz-specific event tracking integration
 */

export interface ZarazEventLogger {
  (event: string, data: any): void
}

/**
 * Creates Zaraz event logger that forwards SDK events to zaraz.track()
 */
export function createZarazEventLogger(): ZarazEventLogger {
  return function (event: string, data: any) {
    if (typeof (window as any).zaraz === 'undefined') {
      return // Zaraz not available
    }

    if (event === 'exposure') {
      // Track exposure using Segment "Experiment Viewed" format
      ;(window as any).zaraz.track('Experiment Viewed', {
        experiment_id: data.name,
        experiment_name: data.name,
        variation_id: String(data.variant),
        variation_name: String(data.variant),
        data,
      })
    } else if (event === 'goal') {
      // Track goals using regular zaraz.track()
      ;(window as any).zaraz.track(data.name, data.properties)
    } else if (event === 'publish') {
      ;(window as any).zaraz.track('absmartly_client_publish')
    }
  }
}

/**
 * Track SDK initialization via Zaraz
 */
export function trackZarazInit(serverData: any, unitType: string) {
  if (typeof (window as any).zaraz !== 'undefined') {
    ;(window as any).zaraz.track('absmartly_client_init', {
      has_server_data: !!serverData,
      unit_type: unitType,
    })
  }
}

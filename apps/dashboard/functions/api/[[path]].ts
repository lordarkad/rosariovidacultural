interface Env {
  API: { fetch: typeof fetch }
}

export async function onRequest(context: { request: Request; env: Env }): Promise<Response> {
  return context.env.API.fetch(context.request)
}

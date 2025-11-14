const MALLA_URL = "https://losvilos.ucn.cl/hawaii/api/mallas";
const MALLA_AUTH = "jf400fejof13f";

type FetchResponse = {
  json: () => Promise<any>;
  ok: boolean;
  status: number;
};

export class ExternalMallaAPI {
  static async fetchMalla(codigo: string, catalogo: string) {
    const queryParam = `${codigo}-${catalogo}`;
    const url = `${MALLA_URL}?${encodeURIComponent(queryParam)}`;

    try {
      const response = (await fetch(url, {
        headers: {
          "X-HAWAII-AUTH": MALLA_AUTH,
        },
      })) as FetchResponse;
      const data = await this.parseJson(response);

      if (!response.ok) {
        const error = new Error(`External Malla API HTTP ${response.status}`);
        (error as any).statusCode = 502;
        (error as any).isExternal = true;
        throw error;
      }

      return data;
    } catch (error) {
      const err = error instanceof Error ? error : new Error("Error consultando malla externa");
      if (!(err as any).statusCode) {
        (err as any).statusCode = 502;
        (err as any).isExternal = true;
      }
      throw err;
    }
  }

  private static async parseJson(response: FetchResponse) {
    try {
      return await response.json();
    } catch (error) {
      const parsingError = new Error("External Malla API response inválida");
      (parsingError as any).statusCode = 502;
      (parsingError as any).isExternal = true;
      throw parsingError;
    }
  }
}

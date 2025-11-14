const AUTH_URL = "https://puclaro.ucn.cl/eross/avance/login.php";

type FetchResponse = {
  json: () => Promise<any>;
  ok: boolean;
  status: number;
};

export class ExternalAuthAPI {
  static async login(username: string, password: string) {
    const url = new URL(AUTH_URL);
    url.search = new URLSearchParams({ email: username, password }).toString();

    const response = (await fetch(url.toString())) as FetchResponse;
    const data = await this.parseJson(response);

    if (!response.ok) {
      const error = new Error(
        `External Auth API HTTP ${response.status}${data?.error ? ` - ${data.error}` : ""}`,
      );
      (error as any).statusCode = 502;
      (error as any).isExternal = true;
      throw error;
    }

    return data;
  }

  private static async parseJson(response: FetchResponse) {
    try {
      return await response.json();
    } catch (error) {
      const parsingError = new Error("External Auth API response inválida");
      (parsingError as any).statusCode = 502;
      (parsingError as any).isExternal = true;
      throw parsingError;
    }
  }
}

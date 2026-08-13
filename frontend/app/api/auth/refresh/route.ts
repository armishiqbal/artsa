import { handleTokenExchange } from "../tokenHandler";

export async function POST(request: Request) {
  return handleTokenExchange(request);
}

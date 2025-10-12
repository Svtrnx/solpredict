export type PythFeedItem = {
  id: string
  attributes: {
    asset_type: string
    base: string 
    description: string 
    display_symbol: string 
    generic_symbol: string 
    quote_currency: string 
    symbol: string 
  }
}

type PricePoint = {
  price: string;
  conf: string;
  expo: number;
  publish_time: number;
};

type ParsedItem = {
  id: string;
  price: PricePoint;
  ema_price: PricePoint;
  metadata: { slot: number; proof_available_time: number; prev_publish_time: number };
};

export type HermesLatestResponse = {
  binary: { encoding: string; data: string[] };
  parsed: ParsedItem[];
};

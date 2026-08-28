export interface AddressForShipping {
  city: string;
  state: string;
  country: string;
}

export interface ShippingOption {
  zoneId: string;
  zoneName: string;
  costNGN: number;
  isFree: boolean;
  estimatedDays: string;
}

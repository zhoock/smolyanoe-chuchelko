import type { PaymentProvider } from '@shared/api/payment/types';

export const PAYMENT_PROVIDERS: Array<{
  id: PaymentProvider;
  name: string;
  logo: string;
}> = [
  {
    id: 'yookassa',
    name: 'ЮKassa',
    logo: 'yookassa',
  },
];
